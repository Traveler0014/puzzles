# puzzles

早睡打卡（[healthy-life](https://github.com/Traveler0014/healthy-life)）的**独立睡前思考题题库**。

- 这里只维护**题目内容**，不含业务代码。
- 产物是一个符合 [PromptBundle 契约](https://github.com/Traveler0014/healthy-life/blob/main/docs/07-prompt-bundle.md) 的 `bundle.json`，通过 GitHub Release 发布。
- 主仓库每天 03:10 自动拉取（`PROMPT_BUNDLE_URL` 指向本仓库的 release 产物），或由 admin 手动导入。

## 写题契约（投稿前必读）

- **入口低**：一句话能懂、来自日常现象，不用术语也能开始想。
- **出口深**：学过初中物理的人也不会秒解；答案有多层推理、或反直觉需纠错、或开放无定论。
- **证否直觉**：题目内主动「证否」最直觉但错误的答案，避免用户自以为想完就结束。
- **source 必填**：答案必须可追溯到公认来源（书/论文/经典结论），无来源不上架。

## 目录结构

```
bundle.yaml            # 包元信息（id/name/version/status）
categories.yaml        # 分类（id → label）
prompts/*.yaml         # 单题一个文件（status: draft | published）
scripts/build.mjs      # 聚合 → dist/bundle.json
scripts/validate.mjs   # 契约 + 跨字段校验
bundle.schema.json     # 契约 JSON Schema（与主仓库同步）
.github/workflows/     # PR 校验 + 打 tag 发布 release
```

## 投稿流程

1. 在 `prompts/` 下新增一个 YAML，`status: draft`，开 PR。
2. CI 自动跑契约校验；不通过会评论反馈。
3. 维护者按「写题契约」审核，通过后把 `status` 改为 `published` 合并。
4. 维护者 bump `bundle.yaml` 的 `version`，打 `vX.Y.Z` tag → 自动发布 release。
5. 主仓库次日自动拉取。

## 本地构建与校验

```bash
npm install
npm run validate   # 构建 + 契约校验
```
