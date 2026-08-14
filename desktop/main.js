const path = require('path');
const axios = require('axios');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { SecureStore } = require('./secure-store');
const { connectYouTube } = require('./youtube-oauth');

let mainWindow;
let agent;
let store;
let dataRoot;

function applySettings(settings) {
  const env = {
    CHEAPER_INFERENCE_API_KEY: settings.llm.apiKey,
    CHEAPER_INFERENCE_MODEL: settings.llm.model,
    CHEAPER_INFERENCE_IMAGE_MODEL: settings.llm.imageModel,
    AI33_API_KEY: settings.speech.apiKey,
    AI33_VOICE_ID: settings.speech.voiceId,
    AI33_TTS_SPEED: settings.speech.speed,
    CHANNEL_NAME: settings.channel.name,
    DEFAULT_AUTHOR: settings.channel.author,
    TARGET_AUDIENCE: settings.channel.targetAudience,
    DEFAULT_PRIVACY_STATUS: settings.channel.privacy,
    BUSINESS_EMAIL: settings.channel.businessEmail,
    WEBSITE_URL: settings.channel.websiteUrl,
    SOCIAL_LINKS: settings.channel.socialLinks,
  };
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && value !== null && value !== '') process.env[key] = String(value);
    else delete process.env[key];
  }
  process.env.YAA_CREDENTIALS_JSON = JSON.stringify({
    youtube: settings.youtube.clientId && settings.youtube.clientSecret ? {
      client_id: settings.youtube.clientId,
      client_secret: settings.youtube.clientSecret,
      redirect_uris: ['http://127.0.0.1'],
    } : undefined,
    channel: settings.channel,
  });
  process.env.YAA_TOKENS_JSON = JSON.stringify({ youtube: settings.youtube.tokens || undefined });
}

async function startBackend() {
  dataRoot = app.getPath('userData');
  process.env.YAA_DATA_DIR = dataRoot;
  process.env.NODE_ENV = 'production';
  store = new SecureStore(path.join(dataRoot, 'secure-settings.bin'));
  applySettings(store.load());
  const { YouTubeAutomationAgent } = require('../index');
  agent = new YouTubeAutomationAgent();
  return agent.start({ allowUnconfigured: true, port: 0 });
}

async function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 700,
    title: 'CreatorPilot',
    backgroundColor: '#08111f',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = `http://127.0.0.1:${port}`;
    if (!url.startsWith(allowed)) {
      event.preventDefault();
      if (/^https:\/\//i.test(url)) shell.openExternal(url);
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  await mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

function registerIpc() {
  ipcMain.handle('settings:get', () => store.publicView());
  ipcMain.handle('settings:save', async (_event, incoming) => {
    const settings = store.update(incoming);
    applySettings(settings);
    setTimeout(() => { app.relaunch(); app.exit(0); }, 500);
    return { ok: true, restarting: true };
  });
  ipcMain.handle('provider:test', async (_event, provider, values = {}) => {
    const settings = store.load();
    if (provider === 'llm') {
      const key = values.apiKey || settings.llm.apiKey;
      if (!key) throw new Error('Enter a Cheaper Inference API key first');
      const response = await axios.get('https://api.cheaperinference.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` }, timeout: 30000,
      });
      return { ok: true, message: `${response.data?.data?.length || 0} models available` };
    }
    if (provider === 'speech') {
      const key = values.apiKey || settings.speech.apiKey;
      if (!key) throw new Error('Enter an AI33 Pro API key first');
      const response = await axios.get('https://api.ai33.pro/v1/credits', {
        headers: { 'xi-api-key': key }, timeout: 30000,
      });
      const credits = response.data?.credits ?? response.data?.data?.credits;
      return { ok: true, message: credits === undefined ? 'AI33 Pro key verified' : `${credits} credits available` };
    }
    throw new Error('Unknown provider');
  });
  ipcMain.handle('youtube:connect', async (_event, values = {}) => {
    const current = store.load();
    const clientId = values.clientId || current.youtube.clientId;
    const clientSecret = values.clientSecret || current.youtube.clientSecret;
    const connected = await connectYouTube(clientId, clientSecret);
    store.update({ youtube: { clientId, clientSecret, tokens: connected.tokens, channelTitle: connected.channelTitle } });
    setTimeout(() => { app.relaunch(); app.exit(0); }, 1000);
    return { ok: true, channelTitle: connected.channelTitle, restarting: true };
  });
  ipcMain.handle('external:open', (_event, url) => {
    const allowed = ['https://cheaperinference.com/', 'https://ai33.pro/', 'https://console.cloud.google.com/'];
    if (!allowed.some(prefix => String(url).startsWith(prefix))) throw new Error('This link is not allowed');
    return shell.openExternal(url);
  });
  ipcMain.handle('data:open', () => shell.openPath(dataRoot));
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  app.whenReady().then(async () => {
    app.setAppUserModelId('com.creatorpilot.youtube');
    registerIpc();
    const backend = await startBackend();
    if (!backend) throw new Error('Local backend failed to start');
    await createWindow(backend.port);
  }).catch(error => {
    const { dialog } = require('electron');
    dialog.showErrorBox('CreatorPilot could not start', error.stack || error.message);
    app.quit();
  });
}

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { if (agent) agent.stop().catch(() => {}); });
