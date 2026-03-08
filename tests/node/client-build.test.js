import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('client build emits the preview worker and main bundle references the emitted path', async () => {
  const workerOutputPath = resolve(rootDir, 'public/assets/js/application/preview-render-worker.js');
  const mainBundlePath = resolve(rootDir, 'public/assets/js/main.js');

  await access(workerOutputPath, fsConstants.R_OK);

  const mainBundle = await readFile(mainBundlePath, 'utf8');
  assert.match(
    mainBundle,
    /new URL\("\.\/application\/preview-render-worker\.js",import\.meta\.url\)/,
  );
});
