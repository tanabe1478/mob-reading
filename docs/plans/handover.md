# ハンドオーバー / セッション引き継ぎ用メモ

> セッションをクリアしても作業を再開できるようにするための常設メモです。更新ルールと現在の状態をここに集約します。

## 使い方
- 作業開始前にこのファイルを読む。
- 作業後に「進捗」と「次やること」を追記または更新する。
- 設計・計画の正本は以下に集約し、重複させない。
  - 詳細設計書: `docs/design/ai-code-reading-tutor.md`
  - 実装計画書 (ローカル read-only PoC): `docs/plans/local-readonly-poc.md`
- pi のルール（AGENTS.md）は必ず遵守。特に「read ツールで全文確認してから編集」「npm run check はコード変更時のみ」「npm run dev/build/test は禁止」。

## 現在地（コンテキスト）
- 目的: Pi を runtime として組み込み、Monaco ベースの read-only コード読解チュータ (localhost 前提) を作る。
- ソース参照用に `pi-mono` を clone 済み (直下に `pi-mono/`)。
- 設計と計画の初版を作成済み。
- Vite + React の骨格、Monaco 表示、WS デモサーバーを追加済み。
- DummyTutorSessionRuntime（擬似 Pi）をサーバーに追加し、WS 経由で editor.action.request / teaching.turn を配信済み。
- 文書ガバナンス: 三層構造 (CLAUDE/specs/adr) を導入。doc-reminder フックと triggers.json を追加。

## 進捗ログ
- 2026-04-13: 設計書と実装計画書を追加。pi-mono を clone。
- 2026-04-13: `package.json`/Vite/React/Monaco の雛形、WS デモサーバー、README を追加。
- 2026-04-13: DummyTutorSessionRuntime と WS broadcast を追加。フロントはサーバー由来の teaching.turn / action を表示。

## 次にやること（優先順）
1) Pi Adapter の実体化
   - Dummy を Pi AgentSessionRuntime ベースに置換し、event → WS 配信を接続。
   - request_ui_focus / publish_explanation_turn などのツールスキーマを server 側に定義。

2) Repo ワークスペース管理とインデックス準備
   - Workspace import (ローカルパス) と revision pin。
   - TS/JS のシンボル抽出・呼び出し関係のインデックス（tree-sitter + TS LS）。

3) フロントのデータ配線強化
   - API/WS クライアントでサーバーイベントを反映（現状のサンプルから実データへ）。
   - TeachingTurn カードを契約どおり拡充（evidence/next options/glossary/quiz）。

4) ドキュメント運用の自動化
   - doc-reminder を Pi セッション/CI 前に実行する手順を整備。
   - 将来: ドリフト検知 (変更ファイル vs spec 更新日) を追加。

5) ポリシー/バリデータ
   - Follow mode / focus policy / range 上限の validator をサーバー側に実装。

6) ハンドオーバー運用
   - 作業後にこのファイルの「進捗ログ」「次にやること」を更新する。

## 決定事項
- v1 は read-only。write/edit/bash はモデルに渡さない。
- 言語対象: TS/JS から開始。
- デプロイ想定なし。localhost で完結。
- UI action は open/reveal/highlight/show_reference_list/queue_tour のみに限定。
- publish_explanation_turn を必須の最終ツールにする方針。

## 参照
- 設計詳細: `docs/design/ai-code-reading-tutor.md`
- 実装計画: `docs/plans/local-readonly-poc.md`
- Pi リポジトリ: `pi-mono/`
- Pi ルール: `pi-mono/AGENTS.md`
