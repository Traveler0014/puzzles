import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import yaml from 'js-yaml';
import { collectRss } from './rss.mjs';
import { collectFeynman } from './feynman.mjs';
import { collectYoutube } from './youtube.mjs';
import { collectStackExchange } from './stackexchange.mjs';
import { collectRaw } from './raw.mjs';

const root = resolve(import.meta.dirname, '..');
const materialDir = resolve(root, 'material');
const processedFile = resolve(materialDir, 'processed.json');

const materialId = (url) => createHash('sha1').update(url).digest('hex').slice(0, 16);

async function main() {
  const conf = yaml.load(readFileSync(resolve(root, 'sources.yaml'), 'utf8'));
  mkdirSync(materialDir, { recursive: true });

  const processed = existsSync(processedFile)
    ? new Set(JSON.parse(readFileSync(processedFile, 'utf8')))
    : new Set();

  const cards = [];
  // 经典谜题种子（raw/*.md）优先：人工策展的素材不应被 maxNewMaterials 配额挤掉
  try {
    const seeds = await collectRaw();
    cards.push(...seeds);
    console.log(`[collect] raw-seeds: ${seeds.length} items`);
  } catch (err) {
    console.error('[collect] raw-seeds failed:', err instanceof Error ? err.message : String(err));
  }
  for (const src of conf.sources) {
    try {
      let items = [];
      if (src.type === 'rss') items = await collectRss(src);
      else if (src.type === 'feynman') items = await collectFeynman(src);
      else if (src.type === 'youtube') items = await collectYoutube(src);
      else if (src.type === 'stackexchange') items = await collectStackExchange(src);
      items.forEach((it) => {
        it.id = materialId(it.url);
        it.channel = src.id;
        if (!it.categoryHint) it.categoryHint = src.categoryHint;
      });
      cards.push(...items);
      console.log(`[collect] ${src.id}: ${items.length} items`);
    } catch (err) {
      console.error(`[collect] ${src.id} failed:`, err instanceof Error ? err.message : String(err));
    }
  }

  const seen = new Set();
  const fresh = cards
    .filter((c) => {
      if (processed.has(c.url) || seen.has(c.url) || !c.url) return false;
      seen.add(c.url);
      return true;
    })
    .slice(0, conf.maxNewMaterials ?? 10);

  writeFileSync(resolve(materialDir, 'new-materials.json'), JSON.stringify(fresh, null, 2) + '\n');
  console.log(`[collect] ${cards.length} items total, ${fresh.length} new materials`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
