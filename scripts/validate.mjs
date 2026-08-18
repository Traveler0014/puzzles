import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv from 'ajv';

const root = resolve(import.meta.dirname, '..');
const schema = JSON.parse(readFileSync(resolve(root, 'bundle.schema.json'), 'utf8'));
const bundle = JSON.parse(readFileSync(resolve(root, 'dist/bundle.json'), 'utf8'));

// 1) JSON Schema 契约校验
const ajv = new Ajv({ allErrors: true });
if (!ajv.validate(schema, bundle)) {
  console.error('契约校验失败：');
  for (const e of ajv.errors ?? []) {
    console.error(`  - ${e.instancePath || '/'} ${e.message}`);
  }
  process.exit(1);
}

// 2) JSON Schema 表达不了的跨字段规则
const catIds = new Set(bundle.categories.map((c) => c.id));
const seen = new Set();
const errors = [];
for (const p of bundle.prompts) {
  if (!catIds.has(p.category)) errors.push(`${p.id}: 分类不存在「${p.category}」`);
  if (seen.has(p.id)) errors.push(`${p.id}: id 重复`);
  seen.add(p.id);
}
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(bundle.version)) {
  errors.push(`version 不符合 semver: ${bundle.version}`);
}
if (bundle.status !== 'published') {
  errors.push('发布产物 status 必须为 published（draft 包不应发布）');
}

if (errors.length > 0) {
  console.error('校验失败：');
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}

console.log(
  `校验通过：${bundle.prompts.length} 题，${bundle.categories.length} 分类，v${bundle.version}`,
);
