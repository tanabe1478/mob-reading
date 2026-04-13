# AI 支援コードリーディング Web アプリ 詳細設計書
Pi runtime 前提 / read-only v1

## 0. 文書前提
- v1 は read-only（編集/実行なし）
- 主対象は TypeScript/JavaScript リポジトリ
- 1 セッション = 1 ユーザー × 1 ワークスペース × 1 リビジョン
- 説明は必ず evidence span に紐づける
- AI の画面操作は UI Action Contract 経由に限定

## 1. 目的と非目的
### 1.1 目的
- 開いているコードを AI がその場で説明できる
- AI が関連定義・呼び出し元・テスト・設定へ自発ジャンプ提案できる
- AI 自身がファイルを開き、範囲をハイライトして導線を作れる
- 「なぜそう言えるか」「次にどこを見るべきか」を提示する
- 説明結果を構造化データで保存し学習評価に使える

### 1.2 非目的
- コード編集提案の自動適用
- ターミナル/テストの自動実行
- 大規模改修エージェント
- マルチユーザー同時編集
- 完全自動の学習者モデル推定

## 2. 設計原則
- Evidence First: すべての主張は evidence span を持つ。直接記述と推論を分離。
- Semantic Navigation Over Raw Search: def/ref/call/test/config を主経路に。grep は fallback。
- Pedagogy Over Task Completion: 修正より理解。説明・根拠・次の観察点・理解確認が中心。
- User Wins: ユーザー操作が最優先。AI の自動ジャンプはフォーカスを奪わない。
- Read-only by Default: v1 の tool surface は読み取り専用。
- Revision-Pinned Understanding: 説明は commit/revision に紐づける。

## 3. Pi をどう使い何を自前で持つか
- Pi から借りる: agent runtime / session lifecycle / event streaming / custom tools / optional session persistence
- 自前で実装: Monaco ベース IDE 画面 / repo intelligence / UI action protocol / learning-oriented explanation contract / evidence rendering / analytics
- SDK を採用（AgentSession 直利用）。理由: event 購読しやすい、JSONL RPC の制約回避、editor sync は独自プロトコルが必要。
- TutorSessionRuntime を薄く置き AgentSessionRuntime を内包。session replace/fork/resume に備える。
- pi-web-ui は本番主レイアウトには使わず、attachment loader / artifact renderer などを選択的に流用。

## 4. 全体アーキテクチャ
```
Browser
 ├ Repo Tree / Symbol Outline
 ├ Monaco Editor
 ├ Tutor Panel (chat + explanation cards)
 ├ Evidence Bar / Tour Queue
 └ Session UI Store
          │ REST + WebSocket
API Gateway / Stream Hub
 ├ Auth / Workspace / Session API
 ├ Editor Action Ack API
 └ WS event fanout
          │
Pi Runtime Adapter          Repo Intelligence Service
 ├ TutorSessionRuntime      ├ Workspace Manager
 ├ Tool Registry            ├ Manifest Builder
 ├ Prompt Builder           ├ Tree-sitter / TS LSP
 ├ Event Mapper             ├ Search / Ripgrep
 └ TeachingTurn Publisher   └ Test / Doc Mapper
          │
Persistence
 ├ PostgreSQL (metadata, analytics)
 ├ Redis (presence, cancellation)
 ├ revision-local index.db (symbols/edges)
 └ FS/obj storage (repo clone, artifacts, sessions)
```

## 5. フロントエンド
- 3 ペイン: 左=ツリー/アウトライン/関連テスト/AI ジャンプ一覧、中央=Monaco + breadcrumbs + evidence highlight + tour overlay、右=chat + explanation card + evidence chips + next step + quiz。
- Follow Mode: off / suggest / guided。初期 suggest。guided は 1 turn 1 回の自動 reveal のみ。
- Editor Action 制約: open/reveal/highlight/show_reference_list/queue_tour のみ。typing 中は hard focus 禁止、1 turn の hard focus は 1 回、highlight は 200 行以内、cross-file 自動 open は guided か user click 時のみ。
- Explanation Card 構造: headline, summary, claims(confidence,evidenceIds,inference), evidence list, nextBestOptions, glossary?, checkQuestion?。
- SelectionContext: rawRange と canonicalRange を分離。canonical は AST/symbol 境界で正規化。

## 6. バックエンド
- モジュール: API Gateway, Workspace Manager, Repo Intelligence, Pi Runtime Adapter, Learning Service。
- TutorSessionRuntime: Pi 依存を閉じ込め、tool set 生成、event を WS に変換、TeachingTurn 保存、session 置換時の再接続を担当。
- Turn Lifecycle: selection送信 → 正規化 → context pack 生成 → Pi prompt → semantic tools → publish_explanation_turn → UI action 検証 → WS 配信 → frontend 適用/拒否 → ack。
- ContextPackBuilder 優先順位: 選択範囲、含有 symbol、直近 navigation、def/caller/callee、関連テスト、近傍コメント/README/ADR、検索 fallback。cap: evidence 最大8、raw code 400行、related files 6、追加文脈~12k tokens。

## 7. Repo Intelligence
- 主役は意味付き移動。インデックス: manifest, symbol table, def/ref edges, call edges, import/deps, related tests, doc links。embedding は補助。
- 構築: 列挙→除外→tree-sitter→symbol 抽出→TS LS で def/ref→call/import edges→テスト関連付け→docs/ADR マップ→index.db。
- 言語: v1 は TS/JS のみ保証。LanguageAdapter 抽象で将来 Python/Go/Java 拡張可。
- EvidenceId = sha1(revisionId+path+start+end+snippetHash)。snippet はサーバー抽出。

## 8. AI/エージェント
- 公開 tool: list_files, read_span, get_symbol_at, jump_to_definition, find_references, find_callers, find_callees, search_text, search_symbols, get_related_tests, request_ui_focus, publish_explanation_turn。
- TeachingTurn 契約 (必須): headline/summary/claims/evidence/uiActions/nextBestOptions/glossary?/checkQuestion?。
- UiAction 種: open_file, reveal_range, highlight_range, show_reference_list, queue_tour（focusMode none/soft/hard）。
- request_ui_focus: action + priority(normal/low)。validator 経由で適用。
- System Prompt 骨格: tutor 役割、semantic tools 優先、すべての主張に evidence、直接記述と推論を分離、low confidence 使用、不要な UI focus を避け、turn 終了時に publish_explanation_turn を 1 回だけ、nextBestOptions 最大3、check question は学習時のみ。
- Turn Mode: selection / trace / architecture / comparison / quiz。mode ごとに tool/context 優先度を変える。
- Interrupt: steer / followUp を区別して Pi の queue を利用。

## 9. UI Action Protocol（アプリ独自）
- サーバー→クライアント: `editor.action.request` (actionId, turnId, UiAction)。
- クライアント→サーバー: `editor.action.applied` {status: applied|rejected, reason?}。
- Validator: path 存在/binary でない/範囲内/ hard focus policy/ guided 以外の cross-file 自動 open 禁止/1 turn 上限。

## 10. API
- REST: workspace import, revision 作成, file get, symbol-at, session 作成, turn 送信, action ack。
- WS: session.ready, agent.turn.started, agent.message.delta, agent.tool.started/updated/finished, teaching.turn, editor.action.request/applied, session.error。
- teaching.turn 例を定義（evidence/snippet/uiActions/nextBestOptions を含む）。

## 11. 永続化
- PostgreSQL: workspace/revision/session/turn metadata, analytics, quiz, action logs。
- Redis: presence, stream state, cancellation。
- revision-local: repo clone, index.db, Pi session file, artifacts。
- Pi session は transcript。DB には metadata のみ保持し、TeachingTurn JSON を turn に保存。

## 12. 学習支援レイヤ
- 粒度切替: line/function/flow/architecture。
- 理解確認: quiz は mode 指定・反復箇所・区切りでのみ、1 問まで。
- Analytics: evidence CTR, AI jump acceptance, manual jump after suggestion, repeated-question rate, claim unsupported rate, quiz accuracy, files touched/turn。

## 13. セキュリティ
- v1 read-only: built-in write/edit/bash は除外。path allow/deny。env/secret/generated を deny。外部ネットワーク禁止。
- 将来 write は runtime 分離 (ReadOnlyTutorRuntime vs PrivilegedEditorRuntime)。

## 14. 非機能
- 目標: file open P95 150ms, symbol lookup 300ms, first token 2.5s, turn 完了 12s, action 反映 150ms。
- 可観測性: prompt build latency, retrieval pack size, tool/LLM latency, validation errors, action accept/reject, token/cost。
- 障害時: LSP 落ち→tree-sitter fallback、symbol 解決不可→read_span、UI action invalid→suggest に downgrade、session replace failure→keep、index stale 警告表示。

## 15. バージョン固定と adapter
- Pi の変更吸収のため adapter 層を用意（event mapping, tool registry, session 再接続, auth, TeachingTurn publish 共通化）。

## 16. テスト戦略
- Unit: SelectionContext 正規化、ContextPackBuilder、ActionValidator、symbol graph query、TeachingTurn schema。
- Integration: jump_to_definition、callers/callees 精度、publish_explanation_turn 強制、editor action request→ack、session resume/revision switch。
- Prompt Regression: 固定 repo/問いで claim に evidence があるか、low confidence 使用、nextBestOptions<=3、無根拠 architecture 語りがないか。
- Human Eval: chat-only vs editor-synced、manual navigation vs AI suggestion、explanation only vs +check question。

## 17. 実装フェーズ
- Phase1: 最小有用版（repo import, revision pin, Monaco+ツリー, read_span/get_symbol_at/jump_to_definition/find_callers, publish_explanation_turn, evidence chip, suggest mode）。
- Phase2: 学習支援強化（guided walkthrough, related tests, glossary, check question, analytics, session resume/fork）。
- Phase3: 拡張（多言語 adapter, docs/ADR linking, architecture mode 強化, compare mode, IDE plugin bridge）。

## 18. 採用判断まとめ
- 成功の本体は Repo Intelligence / Editor Action Protocol / TeachingTurn 契約。Pi は runtime として適合。SDK 埋め込み + semantic tools のみ + structured explanation + Monaco 側で UI 制御が壊れにくい設計。
