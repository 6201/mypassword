const fs = require('fs');
const path = require('path');
const electron = require('electron');

const payload = {
  electronVersion: process.versions.electron || null,
  nodeVersion: process.versions.node,
  runAsNode: process.env.ELECTRON_RUN_AS_NODE || null,
  hasApp: !!electron.app,
  hasWhenReady: !!electron.app?.whenReady,
};

fs.writeFileSync(path.join(__dirname, 'check-electron-app-output.json'), JSON.stringify(payload, null, 2));

if (electron.app) {
  electron.app.whenReady().finally(() => electron.app.quit());
}
