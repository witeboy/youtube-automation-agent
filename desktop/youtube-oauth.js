const http = require('http');
const { google } = require('googleapis');
const { shell } = require('electron');

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

async function connectYouTube(clientId, clientSecret) {
  if (!clientId || !clientSecret) throw new Error('Google OAuth Client ID and Client Secret are required');

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      if (error) reject(error); else resolve(value);
    };

    const server = http.createServer(async (req, res) => {
      const requestUrl = new URL(req.url, 'http://127.0.0.1');
      if (requestUrl.pathname !== '/oauth2callback') {
        res.writeHead(404).end();
        return;
      }
      const oauthError = requestUrl.searchParams.get('error');
      const code = requestUrl.searchParams.get('code');
      if (oauthError || !code) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>YouTube connection failed</h1><p>You may close this window.</p>');
        finish(new Error(oauthError || 'Google returned no authorization code'));
        return;
      }

      try {
        const redirectUri = `http://127.0.0.1:${server.address().port}/oauth2callback`;
        const oauth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
        const { tokens } = await oauth.getToken(code);
        oauth.setCredentials(tokens);
        const youtube = google.youtube({ version: 'v3', auth: oauth });
        const channelResponse = await youtube.channels.list({ part: ['snippet'], mine: true });
        const channelTitle = channelResponse.data.items?.[0]?.snippet?.title || 'Connected YouTube channel';
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>Connected to YouTube</h1><p>${escapeHtml(channelTitle)}</p><p>You may close this window and return to the app.</p>`);
        finish(null, { tokens, channelTitle });
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>Token exchange failed</h1><p>Return to the app for details.</p>');
        finish(error);
      }
    });

    server.listen(0, '127.0.0.1', async () => {
      const redirectUri = `http://127.0.0.1:${server.address().port}/oauth2callback`;
      const oauth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      const authUrl = oauth.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });
      try {
        await shell.openExternal(authUrl);
      } catch (error) {
        finish(error);
      }
    });

    timer = setTimeout(() => finish(new Error('YouTube authorization timed out after five minutes')), 300000);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]);
}

module.exports = { connectYouTube };
