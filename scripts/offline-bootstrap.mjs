// Seed this project's npm cache using already-downloaded tarballs only.
// Normal installs use package-lock.json; this helper is for the offline sandbox.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmRoot = process.env.npm_execpath
  ? path.resolve(path.dirname(process.env.npm_execpath), '..')
  : path.join(path.dirname(process.execPath), 'node_modules', 'npm');
const requireNpm = createRequire(path.join(npmRoot, 'package.json'));
const cacache = requireNpm('cacache');
const semver = requireNpm('semver');
const source = path.resolve(process.argv[2] ?? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'npm-cache', '_cacache'));
const destination = path.join(project, '.npm-cache', '_cacache');
if (source === destination) throw new Error('Source and project cache must differ.');
const inventory = Object.values(await cacache.ls(source));
const index = new Map();
for (const entry of inventory) {
  const match = entry.key.match(/^make-fetch-happen:request-cache:https:\/\/registry\.npmjs\.org\/(.+)\/-\/[^/]+-(\d+\.\d+\.\d+(?:-[^/]+)?)\.tgz$/);
  if (!match) continue;
  const [, name, version] = match;
  if (!index.has(name)) index.set(name, new Map());
  index.get(name).set(version, entry);
}

function packageJson(tarball) {
  const tar = gunzipSync(tarball);
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString().replace(/\0.*$/, '');
    const size = Number.parseInt(header.subarray(124, 136).toString().replace(/\0.*$/, '').trim(), 8) || 0;
    offset += 512;
    if (/^[^/]+\/package\.json$/.test(name)) return JSON.parse(tar.subarray(offset, offset + size).toString('utf8').replace(/^\uFEFF/, ''));
    offset += Math.ceil(size / 512) * 512;
  }
  throw new Error('Tarball lacks its root package.json.');
}

const populated = new Map();
const missing = new Set();
let bytes = 0;
let foreignManifests = 0;
function foreignOptionalManifest(name, range) {
  // The parent package supplies these exact native package names and versions.
  // Foreign-platform tarballs are not needed here. Record their declared pin
  // and platform so npm can produce a complete lockfile. No checksum is invented.
  const native = name.match(/^(?:lightningcss-|@rolldown\/binding-)(android|darwin|linux|win32|freebsd|openharmony)-(arm64|arm|x64|ppc64|s390x)(?:-|$)/);
  if (!native && name !== 'fsevents') return null;
  const targetOs = native?.[1] ?? 'darwin';
  const targetCpu = native?.[2];
  if (targetOs === process.platform && (!targetCpu || targetCpu === process.arch)) return null;
  const version = semver.valid(range) ?? semver.minVersion(range)?.version;
  if (!version) return null;
  const basename = name.split('/').at(-1);
  return {
    name, version, os: [targetOs], ...(targetCpu ? { cpu: [targetCpu] } : {}),
    ...(name.endsWith('-musl') ? { libc: ['musl'] } : {}),
    ...(name.endsWith('-gnu') || name.endsWith('-gnueabihf') ? { libc: ['glibc'] } : {}),
    dist: { tarball: `https://registry.npmjs.org/${name}/-/${basename}-${version}.tgz` },
  };
}
async function seed(name, range, optional = false) {
  const versions = index.get(name);
  const selected = versions && semver.maxSatisfying([...versions.keys()], range);
  if (!selected) {
    if (optional) {
      const manifest = foreignOptionalManifest(name, range);
      if (manifest) {
        const id = `${name}@${manifest.version}`;
        if (!populated.has(id)) { populated.set(id, manifest); foreignManifests++; }
      } else missing.add(`${name}@${range}`);
      return;
    }
    throw new Error(`No cached package satisfies ${name}@${range}.`);
  }
  const id = `${name}@${selected}`;
  if (populated.has(id)) return;
  const entry = versions.get(selected);
  const content = await cacache.get(source, entry.key);
  const manifest = packageJson(content.data);
  if (manifest.name !== name || manifest.version !== selected) throw new Error(`Unexpected tarball identity for ${id}.`);
  manifest.dist = { tarball: entry.key.replace(/^make-fetch-happen:request-cache:/, ''), integrity: entry.integrity };
  populated.set(id, manifest);
  const supports = (list, current) => !list || (!list.includes(`!${current}`) && (list.every(value => value.startsWith('!')) || list.includes(current)));
  if (supports(manifest.os, process.platform) && supports(manifest.cpu, process.arch)) {
    await cacache.put(destination, entry.key, content.data, { integrity: entry.integrity, metadata: content.metadata });
    bytes += content.data.length;
  }
  for (const [dependency, constraint] of Object.entries(manifest.dependencies ?? {})) {
    await seed(dependency, constraint, Object.hasOwn(manifest.optionalDependencies ?? {}, dependency));
  }
  for (const [dependency, constraint] of Object.entries(manifest.optionalDependencies ?? {})) await seed(dependency, constraint, true);
  for (const [dependency, constraint] of Object.entries(manifest.peerDependencies ?? {})) {
    if (!manifest.peerDependenciesMeta?.[dependency]?.optional) await seed(dependency, constraint);
  }
}

const rootPackage = JSON.parse(await fs.readFile(path.join(project, 'package.json'), 'utf8'));
for (const [name, range] of Object.entries({ ...rootPackage.dependencies, ...rootPackage.devDependencies })) await seed(name, range);
const documents = new Map();
for (const manifest of populated.values()) {
  if (!documents.has(manifest.name)) documents.set(manifest.name, { name: manifest.name, 'dist-tags': {}, versions: {} });
  documents.get(manifest.name).versions[manifest.version] = manifest;
}
for (const [name, document] of documents) {
  document['dist-tags'].latest = semver.rsort(Object.keys(document.versions))[0];
  const urls = new Set([`https://registry.npmjs.org/${name}`, `https://registry.npmjs.org/${name.replace('/', '%2f')}`]);
  for (const url of urls) for (const accept of ['application/json', 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*']) {
    await cacache.put(destination, `make-fetch-happen:request-cache:${url}`, JSON.stringify(document), {
      metadata: {
        time: Date.now(), url, reqHeaders: { accept },
        resHeaders: { 'cache-control': 'public, max-age=31557600', 'content-type': 'application/json', date: new Date().toUTCString() },
        options: { compress: true },
      },
    });
  }
}
console.log(`Seeded ${populated.size} package manifests and ${(bytes / 1024 / 1024).toFixed(1)} MiB of platform-compatible tarballs in ${destination}.`);
if (foreignManifests) console.log(`${foreignManifests} foreign-platform optional manifests use declared version pins without unavailable integrity hashes.`);
if (missing.size) console.log(`Unavailable optional packages: ${[...missing].join(', ')}`);
console.log('Run npm install --offline --ignore-scripts to finish the project-local install.');
