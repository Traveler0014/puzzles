# 自动提取题目工作流（Auto-Extraction Pipeline）

> 目标：从**前沿科学新闻、费曼讲义、3Blue1Brown 视频**等渠道持续、低成本地把内容转化成符合契约的候选题目，人工只需「审核」，不写初稿。

## 1. 原则

1. **LLM 只出草稿，人做裁决**：LLM 生成 `status: draft` 的候选，绝不直接上架；上架必须经人工审核改 `published`。
2. **契约优先**：所有候选必须通过 `scripts/validate.mjs`（契约 + 跨字段），不合规直接丢弃。
3. **增量 + 去重**：只处理「没见过」的素材（按 `sourceUrl` 去重），避免重复出题、重复烧 token。
4. **可空跑**：没配 LLM API key 时，采集照常、提取静默跳过，不阻塞、不报错。
5. **source 必填且指向原素材**：LLM 编不出来的题（无来源）宁可 skip。

## 2. 数据源

| 渠道 | 形态 | 采集方式 | 分类映射（categoryHint） |
|---|---|---|---|
| Quanta Magazine | RSS | `rss` | 按板块映射 |
| Phys.org | RSS | `rss` | 按板块映射 |
| ScienceDaily | RSS | `rss` | 按板块映射 |
| arXiv（可选） | RSS | `rss` | 太专业，默认关，人工开启 |
| 费曼物理学讲义 | 公开网页 | `feynman` | `physics` |
| 3Blue1Brown | YouTube 字幕 | `youtube` | `math` |
| Puzzling StackExchange | SE API（高分解谜题+已采纳解答） | `stackexchange` | `logic` |
| 经典谜题种子（人工选定） | `raw/*.md` | `raw`（classic-variant 模式） | 按种子 |

数据源集中配置在 `sources.yaml`，新增渠道只需加一条，不改代码。`raw/*.md` 种子不需要配置，放进目录即被采集。

## 3. 流水线总览

```
GitHub Actions (每天 03:30 UTC / 手动 workflow_dispatch)
        │
        ▼
① collect（采集）──► 各 collector 抓 RSS/网页/字幕 ──► 归一化为「素材卡片」写入 material/
        │
        ▼
② extract（提取）──► 读 material/ 里「未处理」的素材 ──► LLM 按写题契约生成 pending/*.yaml (draft)
        │
        ▼
③ 去重 + 校验 ──► 按 sourceUrl/题目 id 去重 ──► validate.mjs 校验候选
        │
        ▼
④ 自动开 PR ──► 有新的 pending 文件 ──► 推分支 + 开 PR（标题带渠道 + 数量）
        │
        ▼
⑤ 人工审核 ──► maintainer 在 PR 里审：通过 → 移入 prompts/ 改 published；打回 → 删除
        │
        ▼
⑥ 发布 ──► bump version → tag vX.Y.Z → release.yml 发 bundle.json（已有流程）
```

## 4. 目录与文件

```
puzzles/
├── sources.yaml               # 数据源配置
├── collectors/
│   ├── collect.mjs            # 入口：按 source.type 分发
│   ├── rss.mjs                # RSS 抓取
│   ├── feynman.mjs            # 费曼讲义网页抓取（固定章节）
│   └── youtube.mjs            # YouTube 字幕抓取
├── extract/
│   ├── prompt.md              # LLM 提取 prompt 模板（契约的机器化表达）
│   └── extract.mjs            # 调 OpenAI 兼容 API
├── material/                  # 素材卡片缓存（gitignore，本地/CI 各跑各的）
├── pending/                   # 候选题目（draft，待审核）→ 审核后移入 prompts/
├── prompts/                   # 已上架题目（published）
├── scripts/                   # build.mjs / validate.mjs（已有）
└── .github/workflows/
    ├── validate.yml           # 已有
    ├── release.yml            # 已有
    └── collect.yml            # 新增：定时采集 + 提取 + 自动 PR
```

## 5. LLM 提取（核心）

### 5.1 素材卡片（collect 输出，归一化）

```json
{
  "id": "sha1(url)",
  "channel": "quantamagazine",
  "url": "https://...",
  "title": "……",
  "text": "正文 / 摘要 / 字幕（截断到 N 字）",
  "publishedAt": "2026-08-20",
  "categoryHint": "cosmos"
}
```

### 5.2 提取 prompt（`extract/prompt.md` / `extract/variant-prompt.md`）

两种模式，按素材 `mode` 字段选择：

- **默认（科普改写）**：从科普素材提炼一道「现象解释型」题。要点（全文见文件）：系统角色 = 睡前思考题写手，遵守写题契约；明确「不适合出题 → skip」；输出严格 JSON `{"skip":false,"prompt":{...}}`。
- **classic-variant（经典变体）**：`raw/*.md` 种子自动带 `mode: variant`。以经典谜题原型为种子，产出「原型 → 变体 → 元问题」递进链（1～3 道），面向理工科用户的**推理构造型**题型；额外强调「闭眼可推进」（工作记忆负载小，不需纸笔）。输出 `{"skip":false,"prompts":[...]}`（数组）。

通用约束：`id`、`sourceUrl` 由脚本回填（不信任 LLM 生成 id）；LLM 只产 `category/difficulty/source/question/answer`。

### 5.3 输出落地（`extract/extract.mjs`）

- 每个「非 skip」结果生成 `pending/hlx-<slug>.yaml`，`status: draft`（variant 模式一个种子可产多题）。
- `id` 由脚本分配：`hlx-<category>-<counter>`，扫描 `prompts/` + `pending/` 避免重复。
- 署名：素材带 `author`（如 `SE:用户名`）则透传，否则 `auto`。
- 把已处理素材的 `sourceUrl`（种子为 `raw://<name>` 伪 URL）记入 `material/processed.json`，下次跳过。

## 6. 去重策略（三档，从简到严）

1. **素材级（必做）**：`sourceUrl` 见 `processed.json` 即跳过 —— 防止同一篇文章反复出题。
2. **题目 id 级（必做）**：生成 id 时扫已有 `prompts/` + `pending/`，避免撞 id。
3. **语义级（可选，进阶）**：对 question 做 embedding，与已有题余弦相似度 > 阈值则丢弃。初版不做，题库规模上来了再加。

## 7. 成本与治理

- **token 控制**：每篇素材正文截断到约 2000 字；每次运行只处理「新增素材」，上限（如每次 ≤ 10 篇）可在 `sources.yaml` / workflow 里调。
- **审核兜底**：LLM 只产出 draft，`validate.mjs` 拦格式，人拦内容质量；差的候选直接关 PR。
- **可观测**：collect.yml 的日志输出「采集 N 篇 / 提取 M 题 / skip K 篇」。

## 8. 落地文件清单（本次交付）

- `docs/auto-extraction.md`（本文档）
- `sources.yaml`（数据源配置）
- `collectors/collect.mjs` + `rss.mjs` + `feynman.mjs` + `youtube.mjs`
- `extract/prompt.md` + `extract/extract.mjs`
- `.github/workflows/collect.yml`
- `pending/`（空目录 + `.gitkeep`）

## 9. 接入模型（DeepSeek 等 OpenAI 兼容接口）

`extract.mjs` 走 OpenAI 兼容的 `POST {BASE_URL}/chat/completions`，接任意兼容服务只需三个配置：

| 配置 | 说明 | DeepSeek 示例 |
|---|---|---|
| `OPENAI_BASE_URL` | 接口地址，不带 `/v1` 即可（代码会拼 `/chat/completions`） | `https://api.deepseek.com` |
| `LLM_MODEL` | 模型名 | `deepseek-chat` |
| `LLM_TEMPERATURE` | 可选，默认 `0.7`；设为空则不传（`deepseek-reasoner` 不支持该参数） | 留空即可 |

> 注意：`deepseek-reasoner` 不支持 `temperature` 等采样参数，用它时把 `LLM_TEMPERATURE` 设为空；出题推荐直接用 `deepseek-chat`。
