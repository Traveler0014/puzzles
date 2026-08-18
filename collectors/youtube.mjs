import Parser from 'rss-parser';

const UA = 'Mozilla/5.0 (compatible; healthy-life-prompts/0.1; +https://github.com/Traveler0014/puzzles)';

// 用频道 RSS 拿最新视频元数据（无需 API key）；
// 字幕通过可选依赖 youtube-transcript 抓取，失败则退回视频描述。
export async function collectYoutube(source) {
  const parser = new Parser({ headers: { 'User-Agent': UA }, timeout: 30000 });
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${source.channelId}`;
  const feed = await parser.parseURL(feedUrl);
  const items = (feed.items ?? []).slice(0, source.maxVideos ?? 5);

  const out = [];
  for (const it of items) {
    const videoId = (it.id ?? '').split(':').pop() ?? '';
    const desc = String(it.contentSnippet ?? it.summary ?? '');
    let text = desc;
    try {
      const { YoutubeTranscript } = await import('youtube-transcript');
      const lines = await YoutubeTranscript.fetchTranscript(videoId);
      if (lines?.length) text = lines.map((l) => l.text).join(' ');
    } catch {
      // 无字幕 / 依赖缺失 → 退回描述
    }
    out.push({
      url: it.link ?? `https://www.youtube.com/watch?v=${videoId}`,
      title: it.title ?? '',
      text,
      publishedAt: it.isoDate ?? it.pubDate ?? '',
    });
  }
  return out.filter((x) => x.url);
}
