import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

const root = resolve(import.meta.dirname, '..');
const materialDir = resolve(root, 'material');
const pendingDir = resolve(root, 'pending');
const promptsDir = resolve(root, 'prompts');

const API_KEY = process.env.OPENAI_API_KEY ?? '';
const BASE_URL = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
const MODEL = process.env.LLM_MODEL ?? 'gpt-4o-mini';

const TEMPLATE = readFileSync(resolve(import.meta.dirname, 'prompt.md'), 'utf8');

function loadYaml(p) {
  return yaml.load(readFileSync(p, 'utf8'));
}

async function llm(messages) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.7 }),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM 返回空内容');
  return content;
}

/** 容错解析：剥掉可能的 ```json 围栏，取第一个平衡的 {…}。 */
function parseJson(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('输出里没有 JSON 对象');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function existingIds() {
  const ids = new Set();
  for (const dir of [promptsDir, pendingDir]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.yaml')) continue;
      try {
        const d = loadYaml(resolve(dir, f));
        if (d?.id) ids.add(d.id);
      } catch {
        /* 跳过坏文件 */
      }
    }
  }
  return ids;
}

function nextId(category, ids) {
  let n = 1;
  while (ids.has(`hlx-${category}-${String(n).padStart(2, '0')}`)) n += 1;
  const id = `hlx-${category}-${String(n).padStart(2, '0')}`;
  ids.add(id);
  return id;
}

/** 手工构造 YAML：question/answer 用块标量，便于人工审核阅读。 */
function toYaml(p) {
  const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const block = (s) =>
    String(s ?? '')
      .trim()
      .split('\n')
      .map((l) => '  ' + l)
      .join('\n');
  const lines = [
    `id: ${p.id}`,
    `category: ${p.category}`,
    `difficulty: ${p.difficulty}`,
    `source: "${esc(p.source)}"`,
    `sourceUrl: "${esc(p.sourceUrl)}"`,
    `author: ${p.author}`,
    `status: draft`,
    `question: |`,
    block(p.question),
    `answer: |`,
    block(p.answer),
  ];
  return lines.join('\n') + '\n';
}

async function main() {
  if (!API_KEY) {
    console.log('[extract] OPENAI_API_KEY 未配置，跳过提取');
    return;
  }

  const materialsPath = resolve(materialDir, 'new-materials.json');
  if (!existsSync(materialsPath)) {
    console.log('[extract] 无新素材');
    return;
  }
  const materials = JSON.parse(readFileSync(materialsPath, 'utf8'));
  if (materials.length === 0) {
    console.log('[extract] 新素材为空');
    return;
  }

  const categories = loadYaml(resolve(root, 'categories.yaml')).map((c) => c.id);
  const ids = existingIds();
  mkdirSync(pendingDir, { recursive: true });

  const processedFile = resolve(materialDir, 'processed.json');
  const processed = existsSync(processedFile)
    ? new Set(JSON.parse(readFileSync(processedFile, 'utf8')))
    : new Set();

  let made = 0;
  let skipped = 0;
  for (const m of materials) {
    try {
      const sys = TEMPLATE.replace('{{title}}', m.title ?? '')
        .replace('{{url}}', m.url ?? '')
        .replace('{{text}}', String(m.text ?? '').slice(0, 2000));
      const content = await llm([
        { role: 'system', content: sys },
        {
          role: 'user',
          content: `可选分类：${categories.join('、')}。素材分类提示：${m.categoryHint ?? '无'}。请按契约输出 JSON。`,
        },
      ]);
      const out = parseJson(content);
      if (out.skip) {
        skipped += 1;
        console.log(`[extract] skip ${m.url} — ${out.reason ?? ''}`);
      } else {
        const p = out.prompt ?? {};
        const category = categories.includes(p.category) ? p.category : m.categoryHint ?? 'physics';
        const rec = {
          id: nextId(category, ids),
          category,
          difficulty: [1, 2, 3].includes(p.difficulty) ? p.difficulty : 2,
          source: String(p.source ?? m.title ?? '').slice(0, 300),
          sourceUrl: m.url,
          author: 'auto',
          question: String(p.question ?? ''),
          answer: String(p.answer ?? ''),
        };
        if (!rec.question || !rec.answer) {
          console.log(`[extract] skip ${m.url} — 题目/答案为空`);
          skipped += 1;
        } else {
          writeFileSync(resolve(pendingDir, `${rec.id}.yaml`), toYaml(rec));
          made += 1;
        }
      }
    } catch (err) {
      console.error(`[extract] ${m.url} failed:`, err instanceof Error ? err.message : String(err));
    }
    processed.add(m.url);
  }

  writeFileSync(processedFile, JSON.stringify([...processed], null, 2) + '\n');
  console.log(`[extract] made=${made} skipped=${skipped} total=${materials.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
