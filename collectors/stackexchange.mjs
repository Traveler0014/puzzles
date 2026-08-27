/**
 * Stack Exchange（默认 Puzzling）采集器：
 * 拉经典/近期高分解谜题 + 已采纳或最高票解答，作为候选题素材。
 * 内容为 CC BY-SA：提取时改编 + sourceUrl 指回原题 + author 署名（SE 用户名）。
 *
 * 请求预算：每次运行 2 次 questions + 1 次 answers（匿名配额 300 次/天，足够）。
 */
const API = 'https://api.stackexchange.com/2.3';

/** SE 正文是 HTML：粗转文本（保留段落换行），无需额外依赖 */
function htmlToText(html) {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|pre|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function apiGet(path, params) {
  const qs = new URLSearchParams({ site: 'puzzling', ...params });
  const res = await fetch(`${API}${path}?${qs}`, {
    headers: { 'Accept-Encoding': 'gzip' },
  });
  if (!res.ok) throw new Error(`SE API HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  if (typeof data.backoff === 'number') {
    // 尊重回退要求：睡 backoff 秒再继续（Actions 里多等一会无妨）
    await new Promise((r) => setTimeout(r, (data.backoff + 1) * 1000));
  }
  return data;
}

export async function collectStackExchange(source) {
  const site = source.site ?? 'puzzling';
  const minScore = source.minScore ?? 10;
  const maxItems = source.maxItems ?? 12;

  // 两路素材：
  // 1) 历史高票经典（首次运行的大丰收，之后大多已处理过）
  // 2) 近 90 天新题（持续供给），票数客户端过滤
  // 注意：Puzzling 上没有通用的 puzzle 元标签，不传 tagged（传了会把结果集交集成空）
  const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 24 * 3600;
  const common = { filter: 'withbody', pagesize: '100', site };
  const [top, recent] = await Promise.all([
    apiGet('/questions', { order: 'desc', sort: 'votes', min: String(minScore), ...common }),
    apiGet('/questions', {
      order: 'desc',
      sort: 'creation',
      fromdate: String(ninetyDaysAgo),
      ...common,
    }).catch(() => ({ items: [] })), // 新题拉取失败不阻塞经典题采集
  ]);

  const skipTags = new Set(['puzzle-identification']); // 识图找人式元问题，不是谜题素材
  const questions = new Map();
  for (const q of [...(top.items ?? []), ...(recent.items ?? [])]) {
    if (!q.is_answered) continue;
    if ((q.score ?? 0) < minScore) continue;
    if ((q.tags ?? []).some((t) => skipTags.has(t))) continue;
    questions.set(q.question_id, q);
  }
  const chosen = [...questions.values()].slice(0, maxItems);
  if (chosen.length === 0) return [];

  // 一次性批量拉候选题的答案（每题取前 5，后面挑已采纳/最高票）
  const ids = chosen.map((q) => q.question_id).join(';');
  const answers = await apiGet(`/questions/${ids}/answers`, {
    order: 'desc',
    sort: 'votes',
    filter: 'withbody',
    pagesize: '50',
    site,
  });
  const byQuestion = new Map();
  for (const a of answers.items ?? []) {
    const list = byQuestion.get(a.question_id) ?? [];
    list.push(a);
    byQuestion.set(a.question_id, list);
  }

  return chosen.map((q) => {
    const list = byQuestion.get(q.question_id) ?? [];
    const accepted = list.find((a) => a.is_accepted) ?? list[0];
    const ownerName = q.owner?.display_name ?? '';
    return {
      url: q.link,
      title: htmlToText(q.title),
      text:
        htmlToText(q.body).slice(0, 4000) +
        (accepted ? `\n\n=== 参考解答（${accepted.is_accepted ? '已采纳' : '最高票'}）===\n` + htmlToText(accepted.body).slice(0, 4000) : '') +
        (ownerName ? `\n\n（原题作者：${ownerName}）` : ''),
      publishedAt: q.creation_date ? new Date(q.creation_date * 1000).toISOString() : '',
      author: ownerName ? `SE:${ownerName}` : undefined,
    };
  });
}
