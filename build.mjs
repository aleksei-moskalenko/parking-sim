// Builds dist/parking-sim.html: one self-contained page with the code,
// three.js, styles and models inlined, so it opens straight from disk.

import { build } from 'esbuild';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('./', import.meta.url));
const OUT = join(ROOT, 'dist/parking-sim.html');
const MODELS_DIR = 'assets/models';
const MIME = { '.glb': 'model/gltf-binary', '.png': 'image/png' };

const html = await readFile(join(ROOT, 'index.html'), 'utf8');

// The dev page takes three.js from the CDN; the bundle must use the same version.
const cdnVersion = html.match(/three@([\d.]+)/)?.[1];
const { version } = JSON.parse(await readFile(join(ROOT, 'node_modules/three/package.json'), 'utf8'));
if (cdnVersion !== version) throw new Error(`three ${version} installed, index.html uses ${cdnVersion}`);

// Every model file (and its texture) as a data: URL, keyed by the URL the page requests.
const assets = {};
for (const file of await readdir(join(ROOT, MODELS_DIR), { recursive: true })) {
  const mime = MIME[extname(file)];
  if (!mime) continue;
  const data = await readFile(join(ROOT, MODELS_DIR, file));
  assets[`${MODELS_DIR}/${file}`] = `data:${mime};base64,${data.toString('base64')}`;
}

// Loaders fall back to three's default manager, so redirecting it before the
// app starts is enough; this module is imported first and so runs first.
const embedAssets = {
  name: 'embed-assets',
  setup(b) {
    b.onResolve({ filter: /^embedded-assets$/ }, () => ({ path: 'embedded-assets', namespace: 'embed' }));
    b.onLoad({ filter: /.*/, namespace: 'embed' }, () => ({
      resolveDir: ROOT,
      contents: `import { DefaultLoadingManager } from 'three';
const ASSETS = ${JSON.stringify(assets)};
DefaultLoadingManager.setURLModifier((url) => ASSETS[url] ?? url);`,
    }));
  },
};

const { outputFiles } = await build({
  stdin: { contents: "import 'embedded-assets';\nimport './src/main.js';", resolveDir: ROOT },
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  plugins: [embedAssets],
  write: false,
});

const js = outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = (await readFile(join(ROOT, 'styles.css'), 'utf8')).replace(/<\/style/gi, '<\\/style');

const page = html
  .replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '')
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${css}</style>`)
  .replace('<script type="module" src="src/main.js"></script>', () => `<script type="module">\n${js}</script>`);
if (page.includes('importmap') || page.includes('src/main.js')) throw new Error('index.html changed shape, update build.mjs');

await mkdir(join(ROOT, 'dist'), { recursive: true });
await writeFile(OUT, page);
console.log(`${OUT}: ${(Buffer.byteLength(page) / 1024 / 1024).toFixed(2)} MB, ${Object.keys(assets).length} embedded assets`);
