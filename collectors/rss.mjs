import Parser from 'rss-parser';

const UA = 'Mozilla/5.0 (compatible; healthy-life-prompts/0.1; +https://github.com/Traveler0014/puzzles)';

function stripHtml(s) {
  return String(s ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function collectRss(source) {
  const parser = new Parser({ headers: { 'User-Agent': UA }, timeout: 30000 });
  const feed = await parser.parseURL(source.url);
  const items = (feed.items ?? []).slice(0, source.maxItems ?? 20);
  return items
    .map((it) => ({
      url: it.link ?? '',
      title: it.title ?? '',
      text: stripHtml(it.contentSnippet ?? it.content ?? it.summary ?? ''),
      publishedAt: it.isoDate ?? it.pubDate ?? '',
    }))
    .filter((x) => x.url);
}
