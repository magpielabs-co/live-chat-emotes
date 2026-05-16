#!/usr/bin/env node
/**
 * Build a Firefox-ready package from the Chrome MV3 build.
 *
 * Pipeline:
 *   1. Assumes `vite build` has already populated dist/ (we just ran it from
 *      the npm script).
 *   2. Copy dist/ -> dist-firefox/, recursively.
 *   3. Patch manifest.json: inject browser_specific_settings.gecko.
 *      Strip any dev-only "key" field if crxjs left one behind.
 *   4. Zip dist-firefox/ -> dist-firefox.zip for AMO upload.
 *
 * The source manifest in manifest.config.ts stays Chrome-clean. Firefox-only
 * fields live here so the Chrome build is unaffected.
 */

import { existsSync, createWriteStream } from 'node:fs';
import { cp, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import archiver from 'archiver';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CHROME_DIST = join(ROOT, 'dist');
const FIREFOX_DIST = join(ROOT, 'dist-firefox');
const FIREFOX_ZIP = join(ROOT, 'dist-firefox.zip');

// AMO needs a stable extension ID. The strict_min_version pins us to the
// Firefox release that gained MV3 service_worker support (FF 121, Dec 2023).
//
// data_collection_permissions is mandatory on AMO from Nov 2025. This
// extension stores user preferences in chrome.storage.local (device-only),
// makes requests to 7TV with credentials:'omit' and referrer stripped, and
// transmits no user data anywhere - so the correct declaration is
// required:['none']. Older Firefox versions ignore the unknown field.
const GECKO_SETTINGS = {
  id: 'live-chat-emotes@magpielabs.co',
  strict_min_version: '121.0',
  data_collection_permissions: {
    required: ['none'],
  },
};

async function main() {
  if (!existsSync(CHROME_DIST)) {
    console.error('dist/ not found - run `npm run build` first.');
    process.exit(1);
  }

  // Clean prior Firefox artefacts so stale files can't sneak into the zip.
  await rm(FIREFOX_DIST, { recursive: true, force: true });
  await rm(FIREFOX_ZIP, { force: true });

  // Copy Chrome build -> Firefox build.
  await cp(CHROME_DIST, FIREFOX_DIST, { recursive: true });

  // Patch manifest.
  const manifestPath = join(FIREFOX_DIST, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  manifest.browser_specific_settings = { gecko: GECKO_SETTINGS };

  // Firefox MV3 still gates `background.service_worker` behind a pref and
  // rejects it during temporary add-on install / AMO validation. Rewrite to
  // the event-page form (`scripts`). Our background code is pure chrome.*
  // event listeners with no SW-only APIs (no FetchEvent, no clients,
  // no skipWaiting), so the two forms are behaviourally equivalent here.
  // `type: "module"` is preserved - Firefox supports module backgrounds
  // since 106.
  if (manifest.background && manifest.background.service_worker) {
    manifest.background.scripts = [manifest.background.service_worker];
    delete manifest.background.service_worker;
  }

  // crxjs injects a `key` in dev for stable unpacked IDs. Production builds
  // shouldn't have one, but strip defensively - AMO rejects manifests with
  // Chrome-only fields.
  if ('key' in manifest) delete manifest.key;

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  // Zip for AMO submission. AMO accepts the unpacked folder too, but a single
  // .zip is what their upload form expects.
  await new Promise((resolveZip, rejectZip) => {
    const out = createWriteStream(FIREFOX_ZIP);
    const archive = archiver('zip', { zlib: { level: 9 } });
    out.on('close', resolveZip);
    archive.on('error', rejectZip);
    archive.pipe(out);
    archive.directory(FIREFOX_DIST, false);
    archive.finalize();
  });

  console.log(`Firefox build: ${FIREFOX_DIST}`);
  console.log(`Zip:           ${FIREFOX_ZIP}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
