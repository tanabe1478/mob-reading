# CLAUDE.md — Tier 1 (hot memory)

このファイルは常に読み込む前提の最小インデックスです。詳細は Tier 2/3 のドキュメントに委譲します。

## 目的
- このリポジトリでの AI コード読解チュータ開発に必要な最小ルールと参照先を提示する。
- 作業漏れ防止のためのフック（doc-reminder）を案内する。

## 方針サマリ
- v1 は **read-only**。write/edit/bash ツールはモデルに渡さない。
- Pi SDK をランタイムに使い、Monaco ベースの IDE 画面を自前で構成する。
- 説明は `publish_explanation_turn` で構造化し、UI 操作用の `editor.action.request` を通す。
- ドキュメントは三層構造：
  - Tier 1 (これ): 常時ロードするインデックス。
  - Tier 2 (`docs/specs/`): トリガーベースで読む技術仕様。
  - Tier 3 (`docs/adr/`): 意思決定の記録。

## 主要ドキュメント
| Tier | ファイル | 役割 | Trigger |
| --- | --- | --- | --- |
| 1 | CLAUDE.md | 最小ルールと索引 | 常時 |
| 2 | docs/specs/doc-governance.md | ドキュメント運用・フック・三層構造 | `docs/**`, `src/**`, `server/**` |
| 3 | docs/adr/001-doc-governance.md | 三層ドキュメント採用の意思決定 | 参照時 |
| 設計 | docs/design/ai-code-reading-tutor.md | 全体設計 | 設計変更時 |
| 計画 | docs/plans/local-readonly-poc.md | 実装計画 | 計画更新時 |
| ハンドオーバー | docs/plans/handover.md | 引き継ぎメモ | 作業前後 |

## フック / 作業漏れ防止
- 変更ファイルに関連する spec を確認するために:
  ```bash
  node scripts/doc-hooks/doc-reminder.mjs --files <file1> <file2> ...
  ```
  例: `git diff --name-only | xargs node scripts/doc-hooks/doc-reminder.mjs --files`
- doc-reminder は `docs/specs/triggers.json` のトリガーテーブルを使い、関連 spec を列挙する。
- 仕様が変わったら必ず該当 spec に `Last updated:` を更新し、必要なら ADR を追加する。

## 守るべきこと
- `npm run dev / build / test` は使用しない。型検査は `npm run check`。
- 既定は localhost 動作のみ。外部ネットワークアクセスは LLM プロバイダ以外禁止。
- モデルには read-only ツールのみ渡す。
- 編集前に対象ファイルを全文確認する（pi のルール）。

## 参考
- ドキュメント基盤の背景: `docs/adr/001-doc-governance.md`（Agent ADR-006 と論文 *Codified Context* を反映）
- 論文: `/Users/tanabe.nobuyuki/Downloads/2602.20478v1.pdf`（三層コンテキスト、ホット/コールドメモリ、トリガーテーブル、ドリフト検知）
