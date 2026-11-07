// Mirrors the m.n.p component of the root VERSION file into the npm manifests.
// VERSION remains the single source of truth; the manifest fields are derived.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('sync-manifest-version: expected a numeric m.n.p version');
  process.exit(1);
}

for (const file of ['package.json', 'package-lock.json']) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  const manifest = JSON.parse(text);
  let changed = false;
  if (manifest.version !== version) {
    manifest.version = version;
    changed = true;
  }
  const rootPackage = manifest.packages?.[''];
  if (rootPackage && rootPackage.version !== version) {
    rootPackage.version = version;
    changed = true;
  }
  if (changed) {
    // Keep the file's existing line endings so the diff stays version-only.
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const output = JSON.stringify(manifest, null, 2).replace(/\n/g, eol) + eol;
    writeFileSync(file, output);
  }
}
