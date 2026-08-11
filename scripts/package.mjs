/**
 * Cross-platform extension packaging: builds `ai-vocabulary-saver.zip` from
 * the current `dist/` with the archive root as the extension root
 * (manifest.json at the top level, as the Chrome Web Store requires).
 *
 * Windows: PowerShell Compress-Archive. Unix: the `zip` binary.
 * The archive is always recreated from scratch (never merged into), so repeated
 * runs cannot leave stale entries behind.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { platform } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const zipPath = resolve(root, 'ai-vocabulary-saver.zip');
const dist = resolve(root, 'dist');
const where = platform();

if (!existsSync(dist)) {
  console.error('dist/ does not exist. Run `npm run build` first.');
  process.exit(1);
}

if (existsSync(zipPath)) rmSync(zipPath);

if (where === 'win32') {
  execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      'Push-Location dist; Compress-Archive -Path (Get-ChildItem . | ForEach-Object FullName) -DestinationPath ..\\ai-vocabulary-saver.zip -Force; Pop-Location',
    ],
    { cwd: root, stdio: 'inherit' },
  );
} else {
  // Omit any leftover source maps the build should never have emitted.
  execFileSync('zip', ['-r', zipPath, '.', '-x', '*.map'], { cwd: dist, stdio: 'inherit' });
}

console.log(`Packaged ${zipPath}`);