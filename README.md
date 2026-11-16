# Relay · Web Chat

A responsive React chat workspace backed by Node.js, Express, MongoDB/Mongoose and Socket.io. Includes registration and login, hashed passwords, expiring JWT sessions, public channels, the latest 100 persisted messages per channel, online presence, typing indicators, message search, and mobile navigation.

## Run locally

Requires Node.js 22.12+ and MongoDB (local, Docker, or Atlas).

```powershell
cd web-chat
npm install
Copy-Item .env.example .env
# Edit .env: set a random JWT_SECRET and your MONGODB_URI.
# Optional, if Docker is installed:
docker compose up -d
npm run dev
```

Open http://127.0.0.1:5173. Register two accounts in separate browser profiles to chat. The development proxy forwards API requests and Socket.io connections to port 3001. All channels are public to registered users. Accounts and messages are stored in MongoDB; tokens are kept in tab-scoped sessionStorage. Sign out using the arrow beside your profile.

## Build and serve

```powershell
npm run build
npm start
```

Open http://127.0.0.1:3001. The Node server serves the built frontend and real-time backend together. The server binds to loopback for local development. For external deployment, configure the bind address, HTTPS reverse proxy with WebSocket support, database credentials, backups and a stable JWT_SECRET. This single-server implementation needs a shared Socket.io adapter and distributed presence/rate limiting before horizontal scaling. Do not expose the development MongoDB container publicly. Messages are not end-to-end encrypted.

## Verify

`npm test` checks input boundaries and secret-free public payloads. `npm run build` checks frontend compilation. Manual acceptance: create two users, send messages both ways, switch channels, verify typing and presence, refresh to verify persistence, search, create a channel, and sign out. Offline messages stay in the composer; a timeout means delivery is unconfirmed, so check history before retrying. History is limited to the latest 100 messages; pagination and private messaging are outside this version.

References: [Socket.io authentication](https://socket.io/docs/v4/middlewares/), [Socket.io rooms](https://socket.io/docs/v4/rooms/), [Mongoose connections](https://mongoosejs.com/docs/connections.html).

## Media and expression

The composer includes an emoji picker, GIF upload or direct HTTPS `.gif` links, photo uploads, and voice recording. Click your profile avatar to upload a custom photo. Uploads accept JPEG, PNG, WebP, GIF, WebM/Ogg voice recordings, and compatible M4A audio, with an 8 MB limit. Files are stored in MongoDB and require an authenticated account to retrieve. All registered workspace members can view shared media. External GIF links load from their original host; GIF search is not integrated.

Voice notes use the browser MediaRecorder API: allow microphone access, record up to two minutes, stop, preview, then send. Discard cancels recording and releases the microphone. Microphone capture requires localhost or HTTPS and a supported browser. See [MediaRecorder documentation](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder). Actual microphone recording should be checked on the intended device.

Run `node server/smoke.js` with the API and MongoDB running for an integration check covering accounts, sockets, persisted messages, uploaded photos, profile photos, authenticated media retrieval, attachment ownership, and unsupported file rejection. The check removes its temporary accounts, messages, and uploads afterward. Unsent uploads are retained; production deployments should add storage quotas, cleanup policies, and comprehensive media validation.
