const UA = 'Mozilla/5.0 (compatible; healthy-life-prompts/0.1; +https://github.com/Traveler0014/puzzles)';

// 费曼物理学讲义：抓取固定章节网页正文（公开文本）。
// 提取是粗粒度的——去脚本/样式/标签，交给 LLM 理解，不追求结构化完美。

function cleanHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function collectFeynman(source) {
  const items = [];
  for (const ch of source.chapters) {
    const url = `${source.baseUrl}/${ch}.html`;
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA } });
      if (!res.ok) {
        console.error(`[feynman] ${ch} HTTP ${res.status}`);
        continue;
      }
      const text = cleanHtml(await res.text()).slice(0, 4000);
      items.push({
        url,
        title: `费曼物理学讲义 · ${ch.replace('_', '-')}`,
        text,
        publishedAt: '',
      });
    } catch (err) {
      console.error(`[feynman] ${ch} failed:`, err instanceof Error ? err.message : String(err));
    }
  }
  return items;
}
