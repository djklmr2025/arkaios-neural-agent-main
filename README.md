# ARKAIOS NEURAL AGENT

Electron desktop app (ESM) migrated from NeuralAgent. Includes preload/monitor hotfixes and defensive store handling.

## Dev

Requirements: Node.js 18+, pnpm or npm.

```bash
# install
npm install

# run dev (uses packaged build assets under neuralagent-app/build)
npm run start

# build installer
npm run build
```

## Release

GitHub Actions will build on tag pushes and publish artifacts to Releases.

