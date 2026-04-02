const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const tag = process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || '';

if (!tag) {
  console.error('Missing tag: set RELEASE_TAG or GITHUB_REF_NAME');
  process.exit(1);
}

function runGh(args, options = {}) {
  const result = cp.spawnSync('gh', args, {
    stdio: 'pipe',
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

const ghCheck = runGh(['--version'], { stdio: 'ignore' });
if (ghCheck.status !== 0) {
  console.error('GitHub CLI (gh) is required but was not found in PATH');
  process.exit(1);
}

function collectFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

if (!fs.existsSync('release')) {
  console.error('Release directory not found: release/');
  process.exit(1);
}

const allFiles = collectFiles('release');
const assets = allFiles.filter(filePath => {
  const base = path.basename(filePath);
  return /\.(exe|dmg|AppImage|deb|blockmap)$/i.test(filePath) ||
    (/^latest/i.test(base) && /\.yml$/i.test(base));
});

if (!assets.length) {
  console.error('No release artifacts found under release/');
  process.exit(1);
}

function ensureDraftRelease(targetTag) {
  const view = runGh(['release', 'view', targetTag, '--json', 'isDraft']);

  if (view.status !== 0) {
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(view.stdout || '{}');
  } catch {
    console.error(`Unable to parse release metadata for ${targetTag}`);
    process.exit(1);
  }

  if (!parsed.isDraft) {
    console.error(`Release ${targetTag} already exists and is not a draft. Refusing to overwrite published assets.`);
    process.exit(1);
  }
}

ensureDraftRelease(tag);

const create = runGh(['release', 'create', tag, ...assets, '--draft', '--generate-notes'], { stdio: 'inherit' });
if (create.status === 0) {
  process.exit(0);
}

ensureDraftRelease(tag);

const upload = runGh(['release', 'upload', tag, ...assets, '--clobber'], { stdio: 'inherit' });
process.exit(upload.status);
