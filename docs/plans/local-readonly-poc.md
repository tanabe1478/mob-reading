# 実装計画（ローカルホスト前提 / read-only v1）

## ゴール
- Pi SDK を組み込んだローカル Web アプリ（Monaco ベース）で、read-only のコード読解チュータを動かす。
- AI は publish_explanation_turn で構造化説明を返し、UI action request でエディタを誘導する。
- デプロイは行わず、localhost のみを対象とする。

## スコープ
- 対象言語: TS/JS。
- 権限: read-only。write/edit/bash は無効。
- 実行環境: node + browser。バックエンドはローカルで起動。

## マイルストン
1. ベース環境
   - [ ] `pi-mono` をローカル clone 済み（pi runtime ソース参照用）。
   - [ ] プロジェクトの package.json 作成（後続で決定）。
   - [ ] エディタ UI 用の React + Vite または Next.js (app router) 立ち上げ。

2. Repo ワークスペース & インデックス（ローカル）
   - [ ] Workspace Manager: Git/zip import（ローカルパス指定）+ revision pin。
   - [ ] Generated/binary の除外リスト実装。
   - [ ] TS/JS の symbol/index.db 生成（tree-sitter + TS LS）。

3. Pi Adapter 層
   - [ ] Pi SDK (AgentSessionRuntime) をローカルサーバーに組み込み。
   - [ ] Tool registry (read_span, get_symbol_at, jump_to_definition, find_callers/find_callees, search_text, search_symbols, get_related_tests, request_ui_focus, publish_explanation_turn)。
   - [ ] Event mapping: pi message/tool/turn → WS events。
   - [ ] Session lifecycle: start/replace/resume を TutorSessionRuntime でラップ。

4. API / WS
   - [ ] REST: workspace import, revision create, file get, symbol-at, session create, turn send, action ack。
   - [ ] WS: session.ready, agent.turn.started, message.delta, tool.* (start/update/end), teaching.turn, editor.action.request/applied, session.error。
   - [ ] UI Action Validator 実装（path/range/focus policy/guided 条件）。

5. フロントエンド（localhost）
   - [ ] レイアウト: 左=ツリー/アウトライン、中央=Monaco、右=Tutor Panel。
   - [ ] Follow mode: off/suggest/guided。初期 suggest。
   - [ ] Evidence highlight & chips。UI action 適用/拒否 & ack。
   - [ ] Explanation card (headline/summary/claims/evidence/next options/quiz)。
   - [ ] SelectionContext 正規化（raw/canonical）。

6. 学習支援ロジック
   - [ ] System prompt/turn mode（selection/trace/architecture/comparison/quiz）。
   - [ ] publish_explanation_turn を必須化する guard。
   - [ ] request_ui_focus を soft/guided に制御。
   - [ ] Analytics のイベントスキーマ（click/accept/reject）。

7. 非機能・運用（ローカル）
   - [ ] Logging/metrics（prompt build, retrieval size, tool/LLM latency）。
   - [ ] Config: .env.local で API キー等。外部ネットワーク既定 deny を明示。
   - [ ] npm scripts: dev (backend+frontend 同時), build (typecheck), test (unit/integration subset)。

## 初回 PoC の優先タスク
- [ ] フロント: Monaco でファイル表示 + WS 受信の highlight 適用。
- [ ] Backend: read_span / jump_to_definition / find_callers を Pi tool として公開。
- [ ] teaching.turn を受けて右ペインに explanation card を描画。
- [ ] editor.action.request → applied/rejected の往復を通す。
- [x] session REST API + WS event hub による teaching.turn 配信。

## ローカル専用の注意
- デプロイ不要。localhost:3000/4000 前提。
- Repo はローカルパス import。外部 clone する場合も開発者の手元のみ。
- 外部ネットワークアクセスはデフォルト禁止（LLM プロバイダ通信のみ許可）。

## 参照
- 設計書: `docs/design/ai-code-reading-tutor.md`
- Pi runtime ソース: `pi-mono/packages/` 配下
