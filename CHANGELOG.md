# Changelog

## 0.2.0 (2026-08-27)

- 新增「逻辑构造」分类与两道推理构造型题（面向理工科用户）：
  - `hlx-logic-01` 十瓶药一次称出变质瓶（含天平变体与「结果树」元方法论）
  - `hlx-logic-02` 任意日期星期几心算（Doomsday 锚点法的推导、闰年/世纪修正与 28 年日历循环）
- 新增 Puzzling StackExchange 采集器（`collectors/stackexchange.mjs`）：高分解谜题 + 已采纳解答作为素材流（CC BY-SA，改编 + 署名）。
- 新增经典谜题种子目录 `raw/` 与 classic-variant 提取模式（`extract/variant-prompt.md`）：以经典原型为种子产出「原型 → 变体 → 元问题」递进链候选。
- 新增自动发版 workflow（`release-auto.yml`）：合并到 main 且 prompts 有变更时自动 bump minor + 发布 release。

## 0.1.0 (2026-08-20)

- 初始社区题库：3 题（天文宇宙 / 冷与热 / 力与运动）。
- 搭建题目包构建与校验脚本（build.mjs / validate.mjs）。
