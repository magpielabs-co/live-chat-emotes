#!/usr/bin/env node
/**
 * Build the source zip that AMO requires alongside dist-firefox.zip on
 * first submission (because the published bundle is transpiled).
 *
 * Reviewers run `npm install` + `npm run build:firefox` against the
 * extracted zip and verify the output matches the submitted bundle.
 *
 * This script uses an explicit allowlist - safer than relying on a
 * blocklist when the deliverable is going public. Add a path here only
 * if it's actually needed to reproduce the build.
 */

import { existsSync, createWriteStream, statSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import archiver from 'archiver';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_ZIP = join(ROOT, 'dist-firefox-source.zip');

// Required to reproduce the build. Script aborts if any are missing.
const REQUIRED_FILES = [
  'package.json',
  'package-lock.json',
  'manifest.config.ts',
  'vite.config.ts',
  'tsconfig.json',
  'BUILD.md',
];

const REQUIRED_DIRS = [
  'src',
  'scripts',
];

// Included if present, skipped silently if not. These help the reviewer
// understand context but aren't needed to reproduce the build.
const OPTIONAL_FILES = [
  'LICENSE',
  'README.md',
  'SECURITY.md',
  'PRIVACY.md',
  'vitest.config.ts',
  '.gitignore',
];

const OPTIONAL_DIRS = [
  'tests',
];

// Patterns to skip inside any included directory.
const IGNORE_PATTERNS = [
  '**/*.tmp',
  '**/*.timestamp-*.mjs',
  '**/.DS_Store',
];

async function main() {
  await rm(OUT_ZIP, { force: true });

  // Fail loudly on missing required inputs - better than silently shipping
  // an unbuildable source zip.
  const missing = [];
  for (const f of REQUIRED_FILES) {
    if (!existsSync(join(ROOT, f))) missing.push(f);
  }
  for (const d of REQUIRED_DIRS) {
    if (!existsSync(join(ROOT, d))) missing.push(d + '/');
  }
  if (missing.length) {
    console.error('Missing required files for source zip:');
    for (const m of missing) console.error('  - ' + m);
    console.error('');
    console.error('Aborting.');
    process.exit(1);
  }

  await new Promise((resolveZip, rejectZip) => {
    const out = createWriteStream(OUT_ZIP);
    const archive = archiver('zip', { zlib: { level: 9 } });
    out.on('close', resolveZip);
    archive.on('error', rejectZip);
    archive.pipe(out);

    const addFile = (rel) => {
      archive.file(join(ROOT, rel), { name: rel });
    };
    const addDir = (rel) => {
      // archiver's glob() expands the pattern with cwd, so files land at
      // their relative paths inside the zip - matching the source layout.
      archive.glob(`${rel}/**/*`, {
        cwd: ROOT,
        nodir: true,
        ignore: IGNORE_PATTERNS,
        dot: false,
      });
    };

    for (const f of REQUIRED_FILES) addFile(f);
    for (const d of REQUIRED_DIRS) addDir(d);

    for (const f of OPTIONAL_FILES) {
      if (existsSync(join(ROOT, f))) addFile(f);
    }
    for (const d of OPTIONAL_DIRS) {
      if (existsSync(join(ROOT, d))) addDir(d);
    }

    archive.finalize();
  });

  const sizeKB = (statSync(OUT_ZIP).size / 1024).toFixed(1);
  console.log(`Source zip: ${OUT_ZIP} (${sizeKB} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
