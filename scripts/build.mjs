import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

const root = resolve(import.meta.dirname, '..');
const meta = yaml.load(readFileSync(resolve(root, 'bundle.yaml'), 'utf8'));
const categories = yaml.load(readFileSync(resolve(root, 'categories.yaml'), 'utf8'));

const prompts = readdirSync(resolve(root, 'prompts'))
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => yaml.load(readFileSync(resolve(root, 'prompts', f), 'utf8')))
  .filter((p) => p.status === 'published') // draft 不入发布产物
  .map(({ status, ...p }) => p); // 去掉内部流程字段

const bundle = { ...meta, categories, prompts };
mkdirSync(resolve(root, 'dist'), { recursive: true });
writeFileSync(resolve(root, 'dist/bundle.json'), JSON.stringify(bundle, null, 2) + '\n');
console.log(`built dist/bundle.json: ${prompts.length} prompts`);
