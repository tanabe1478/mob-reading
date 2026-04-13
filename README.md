# AI コード読解チュータ（ローカル PoC）

Pi を runtime として組み込む前提で、Monaco ベースの read-only コード読解 UI の骨組みです。デプロイは行わず、localhost での動作を想定しています。

## 目標
- 左: リポジトリツリー/アウトライン、中央: Monaco、右: Tutor パネルの 3 ペイン構成。
- AI からの `editor.action.request` を受けてコードハイライトを反映。
- `teaching.turn` を構造化表示（headline / claims / summary）。

## いま含まれるもの
- `src/` : React + Vite 構成の UI 雛形（Monaco 表示、ハイライト適用、サンプルボタン）。
- `server/` : Express + ws のデモサーバー。DummyTutorSessionRuntime が `editor.action.request` と `teaching.turn` を配信。
- 型定義: `src/types/agent.ts` に UI action / teaching.turn の型。
- スタイル: `src/styles.css` に 3 ペインとハイライト装飾。
- ドキュメント: 三層構造（Tier1: `CLAUDE.md`, Tier2: `docs/specs/`, Tier3: `docs/adr/`）。doc-reminder フック付き。

## 動かし方（ローカル）
> pi のルールに従い、`npm run dev` / `npm run build` / `npm test` は使いません。

```bash
npm install
npm run serve:backend   # localhost:4000 に WS/health を起動
npm run serve:frontend  # localhost:3000 に UI を起動
```

- フロントエンドは WS `ws://localhost:4000/ws?sessionId=<sessionId>` に接続し、`sessionId` を WebSocket クエリで渡すことでイベントを受信します。
- `npm run check` で TypeScript 型検査を実行できます。

## API
- `POST /api/sessions`
  - body: `{}`
  - response: `{ sessionId: string }`
  - 1 セッションにつき 1 つ の `sessionId` を返します。
- `POST /api/sessions/:sessionId/turns`
  - body: `{ message?: string; selectionContext?: SelectionContext; mode?: 'selection' | 'trace' | 'architecture' | 'comparison' | 'quiz' }`
  - response: `{ status: 'queued'; turnId: string }`
  - AI turn をキューに追加し、バックエンドから `teaching.turn` を WebSocket で配信します。
- `POST /api/sessions/:sessionId/actions/:actionId/ack`
  - body: `{ turnId: string; actionId: string; status: 'applied' | 'rejected'; reason?: string }`
  - リクエストボディはフロントエンドの ack をそのまま転送し、後続のイベント処理で利用できるようにします。

## ドキュメントフック（doc-check）
`npm run doc-check` で `docs/specs/triggers.json` に基づき変更ファイルに対応する spec（Tier 2）を自動列挙します。`serve:frontend`, `serve:backend`, `check` はすべて `doc-check` を先に実行するため、ドキュメント リマインダーが必ず走ります。

## 次の実装ポイント
- Pi SDK (AgentSessionRuntime) を組み込み、`editor.action.request`/`teaching.turn` を実データで流す。
- Repo workspace/import + TS/JS インデックス（tree-sitter + TS LS）。
- Follow mode / validator / action ack などのポリシー実装。
- Explanation card を TeachingTurn 契約に沿って拡充。

## 参照
- 設計書: `docs/design/ai-code-reading-tutor.md`
- 実装計画: `docs/plans/local-readonly-poc.md`
- ハンドオーバー: `docs/plans/handover.md`
- Pi ソース: `pi-mono/`
