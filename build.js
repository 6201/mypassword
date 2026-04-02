const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwindcss = require('@tailwindcss/postcss');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const OUTPUT_DIR = 'release';

// 构建渲染进程 (React + Tailwind CSS)
async function buildRenderer() {
  try {
    // 先处理 CSS 文件
    const cssContent = fs.readFileSync('src/renderer/src/styles/index.css', 'utf8');
    const result = await postcss([tailwindcss()]).process(cssContent, {
      from: 'src/renderer/src/styles/index.css',
    });

    fs.mkdirSync('dist/renderer', { recursive: true });
    fs.writeFileSync('dist/renderer/styles.css', result.css);

    // 复制 index.html
    const htmlContent = fs.readFileSync('src/renderer/index.html', 'utf8');
    fs.writeFileSync('dist/renderer/index.html', htmlContent);

    await esbuild.build({
      entryPoints: ['src/renderer/src/index.tsx'],
      bundle: true,
      outfile: 'dist/renderer/bundle.js',
      platform: 'browser',
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
      },
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      minify: true,
      sourcemap: false,
      external: ['*.css'],
    });
    console.log('Renderer build complete!');
  } catch (err) {
    console.error('Renderer build failed:', err);
    process.exit(1);
  }
}

// 构建主进程
async function buildMain() {
  try {
    await esbuild.build({
      entryPoints: ['src/main/index.ts', 'src/main/preload.ts'],
      bundle: true,
      outdir: 'dist/main',
      platform: 'node',
      format: 'cjs',
      loader: {
        '.ts': 'ts',
      },
      sourcemap: true,
      external: ['electron', 'better-sqlite3'],
    });
    console.log('Main process build complete!');
  } catch (err) {
    console.error('Main build failed:', err);
    process.exit(1);
  }
}

function killRunningAppProcesses() {
  if (process.platform !== 'win32') return;

  const targets = ['MyPassword.exe', 'electron.exe'];
  for (const target of targets) {
    spawnSync('taskkill', ['/F', '/IM', target], { stdio: 'ignore', shell: true });
  }
}

function cleanOutputDir() {
  try {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } catch (error) {
    console.warn(`Failed to clean ${OUTPUT_DIR}: ${error.message}`);
  }
}

function installAppDeps() {
  execFileSync('npx', ['electron-builder', 'install-app-deps'], { stdio: 'inherit', shell: true });
}

function runPackager() {
  const args = process.argv.slice(2).filter(arg => arg !== '--package');
  execFileSync('npx', ['electron-builder', ...args], { stdio: 'inherit', shell: true });
}

function runElectronApp() {
  const env = { ...process.env };
  // Some shells export this globally; remove it so Electron runs in app mode.
  delete env.ELECTRON_RUN_AS_NODE;

  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(command, ['electron', '.'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env
  });

  if (result.status && result.status !== 0) {
    process.exit(result.status);
  }
}

// 运行构建
(async () => {
  await buildMain();
  await buildRenderer();
  console.log('All builds complete!');

  if (process.argv.includes('--run-app')) {
    runElectronApp();
    return;
  }

  if (process.argv.includes('--package')) {
    killRunningAppProcesses();
    installAppDeps();
    cleanOutputDir();
    runPackager();
  }
})();
