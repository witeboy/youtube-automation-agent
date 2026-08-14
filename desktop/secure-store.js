const fs = require('fs');
const path = require('path');
const { safeStorage } = require('electron');

const DEFAULT_SETTINGS = {
  llm: { apiKey: '', model: 'gpt-5-mini', imageModel: 'grok-imagine' },
  speech: { apiKey: '', voiceId: 'edge_en-US-AriaNeural', speed: 1 },
  youtube: { clientId: '', clientSecret: '', tokens: null, channelTitle: '' },
  channel: {
    name: '', author: '', targetAudience: '', privacy: 'private',
    businessEmail: '', websiteUrl: '', socialLinks: '',
  },
};

function mergeSettings(current, incoming) {
  const result = JSON.parse(JSON.stringify(current || DEFAULT_SETTINGS));
  for (const section of Object.keys(DEFAULT_SETTINGS)) {
    result[section] = { ...DEFAULT_SETTINGS[section], ...(result[section] || {}) };
    for (const [key, value] of Object.entries(incoming?.[section] || {})) {
      // Blank secret fields mean "keep the saved value" in the desktop UI.
      if (['apiKey', 'clientSecret'].includes(key) && value === '') continue;
      result[section][key] = value;
    }
  }
  return result;
}

class SecureStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  load() {
    if (!fs.existsSync(this.filePath)) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Windows credential encryption is not available on this computer');
    }
    const encrypted = fs.readFileSync(this.filePath);
    const settings = JSON.parse(safeStorage.decryptString(encrypted));
    return mergeSettings(DEFAULT_SETTINGS, settings);
  }

  save(settings) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Windows credential encryption is not available on this computer');
    }
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const encrypted = safeStorage.encryptString(JSON.stringify(settings));
    fs.writeFileSync(this.filePath, encrypted);
  }

  update(incoming) {
    const settings = mergeSettings(this.load(), incoming);
    this.save(settings);
    return settings;
  }

  publicView(settings = this.load()) {
    return {
      llm: {
        hasApiKey: Boolean(settings.llm.apiKey),
        model: settings.llm.model,
        imageModel: settings.llm.imageModel,
      },
      speech: {
        hasApiKey: Boolean(settings.speech.apiKey),
        voiceId: settings.speech.voiceId,
        speed: settings.speech.speed,
      },
      youtube: {
        clientId: settings.youtube.clientId,
        hasClientSecret: Boolean(settings.youtube.clientSecret),
        connected: Boolean(settings.youtube.tokens?.refresh_token || settings.youtube.tokens?.access_token),
        channelTitle: settings.youtube.channelTitle || '',
      },
      channel: settings.channel,
    };
  }
}

module.exports = { SecureStore, DEFAULT_SETTINGS, mergeSettings };
