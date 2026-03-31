const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwindcss = require('@tailwindcss/postcss');
const fs = require('fs');

// 构建渲染进程 (React + Tailwind CSS)
async function buildRenderer() {
  try {
    // 先处理 CSS 文件
    const cssContent = fs.readFileSync('src/renderer/src/styles/index.css', 'utf8');
    const result = await postcss([tailwindcss()]).process(cssContent, {
      from: 'src/renderer/src/styles/index.css',
    });

    // 确保输出目录存在
    if (!fs.existsSync('dist/renderer')) {
      fs.mkdirSync('dist/renderer', { recursive: true });
    }
    fs.writeFileSync('dist/renderer/styles.css', result.css);

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
      bundle: false,
      outdir: 'dist/main',
      platform: 'node',
      format: 'cjs',
      loader: {
        '.ts': 'ts',
      },
      sourcemap: true,
    });
    console.log('Main process build complete!');
  } catch (err) {
    console.error('Main build failed:', err);
    process.exit(1);
  }
}

// 运行构建
(async () => {
  await buildMain();
  await buildRenderer();
  console.log('All builds complete!');
})();
