const { spawnSync } = require('child_process');
const path = require('path');

const target = process.argv[2];
if (!target) {
  console.error('Usage: node run-electron-script.js <script-path>');
  process.exit(1);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const electronBin = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');
const result = spawnSync(electronBin, [target], {
  stdio: 'inherit',
  env,
  cwd: path.join(__dirname, '..'),
  shell: false,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
