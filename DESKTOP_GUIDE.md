# CreatorPilot desktop guide

CreatorPilot is the installable Windows edition of YouTube Automation Agent. It uses your own provider accounts and keeps credentials encrypted on the computer where the app is installed.

## APIs required

### 1. Cheaper Inference — required for AI generation

- Create an account at <https://cheaperinference.com/>.
- Add funds, create an API key, and optionally restrict the key by model and monthly budget.
- Base URL used by the app: `https://api.cheaperinference.com/v1`.
- Authentication: `Authorization: Bearer ir_live_...`.
- Used for content strategy, scripts, titles, descriptions, tags, and generated visuals.
- Default text model: `gpt-5-mini` (editable in Settings).
- Default image model: `grok-imagine` (editable in Settings).

The provider's model catalog changes over time. If a default model is not enabled for your account, copy a current model ID from the Cheaper Inference dashboard into Settings.

### 2. AI33 Pro / OpenSpeaker — required for narrated videos

- Create an account at <https://ai33.pro/> and create an external API key.
- Base URL used by the app: `https://api.ai33.pro`.
- Authentication: `xi-api-key: ...`.
- TTS creation: `POST /v3/text-to-speech`.
- Voice discovery: `GET /v3/voices`.
- Task status: `GET /v1/task/{task_id}`.
- STT creation: `POST /v1/task/speech-to-text`.
- Default voice: `edge_en-US-AriaNeural` (editable in Settings).

AI33 jobs are asynchronous. CreatorPilot creates the job, respects rate-limit retry headers, polls until completion, downloads the audio, and then muxes it into the video. STT support is available in the integration layer; the normal generation pipeline builds captions from its own script and therefore does not need to transcribe its narration again.

### 3. Google / YouTube APIs — required only for publishing

Local video generation works without a YouTube connection. To upload and schedule videos:

1. Open <https://console.cloud.google.com/> and create or select a project.
2. Enable **YouTube Data API v3** and **YouTube Analytics API**.
3. Configure the OAuth consent screen.
4. Create an OAuth Client ID with application type **Desktop app** (recommended).
5. Paste the Client ID and Client Secret into CreatorPilot Settings.
6. Select **Connect channel** and approve access in the browser.

If you created a **Web application** OAuth client instead, add this exact value under **Authorized redirect URIs** in Google Cloud before connecting:

```text
http://127.0.0.1:53682/oauth2callback
```

The scheme, IP address, port, path, and lack of trailing slash must match exactly. CreatorPilot now uses this stable callback instead of choosing a random port, so either a Desktop client or a correctly configured Web client can connect. A Google `redirect_uri_mismatch` error means the OAuth client type or its registered URI does not match this value.

The app requests upload, read-only channel, and read-only analytics scopes. New uploads default to **private** unless you deliberately change the setting.

## Install and use

1. Run `CreatorPilot-Setup-2.4.2.exe`.
2. Open CreatorPilot and go to **Settings**.
3. Add Cheaper Inference and AI33 Pro keys, then test each connection.
4. Add channel defaults. Save; the app restarts to load the providers.
5. Optionally connect YouTube.
6. Open **Create video**, enter a topic, choose a format, and select **Generate video**.

Generated databases, logs, media, OAuth tokens, and encrypted settings live under the current Windows user's CreatorPilot application-data directory. Use **Settings → Open app data** to open that exact directory.

## Security model

- Provider keys, the Google client secret, and OAuth tokens are encrypted with Electron `safeStorage`, which uses the operating system's credential protection on Windows.
- Secrets are decrypted only in the desktop main process and are never exposed to the dashboard renderer.
- The backend listens only on `127.0.0.1` and chooses an available random port.
- External links are allowlisted and opened in the default browser.
- The application does not embed shared service keys; every paid request uses the keys supplied by the person running the app.

## Developer commands

```powershell
npm install
npm run desktop
npm test
npm run lint
npm run dist:win
```

The installer is written to `dist/`.
