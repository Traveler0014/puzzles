import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 经典谜题种子采集器：读取 raw/*.md，交给 classic-variant 提取模式
 * 产出「原型 → 变体 → 元问题」递进链候选题（一个种子最多出 3 道）。
 *
 * 文件格式（简单 frontmatter，避免额外依赖）：
 * ---
 * title: 十二硬币问题
 * source: 《Mathematical Puzzles》Peter Winkler
 * sourceUrl: https://…            # 可选
 * author: 张三                    # 可选
 * ---
 * 题目正文……
 */
const root = resolve(import.meta.dirname, '..');

function parseFrontmatter(raw, file) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw.trim() };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2].trim() };
}

export async function collectRaw() {
  const dir = resolve(root, 'raw');
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  const cards = [];
  for (const f of files) {
    const { meta, body } = parseFrontmatter(readFileSync(resolve(dir, f), 'utf8'), f);
    if (!body) continue;
    cards.push({
      // 稳定伪 URL：processed.json 按此去重（同一种子只提取一次）
      url: `raw://${f.replace(/\.md$/, '')}`,
      title: meta.title ?? f.replace(/\.md$/, ''),
      text: body,
      mode: 'variant',
      author: meta.author,
      seedSource: meta.source,
      seedSourceUrl: meta.sourceUrl,
    });
  }
  return cards;
}
