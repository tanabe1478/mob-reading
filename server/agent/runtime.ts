import { AgentEvent } from '../../src/types/agent';

export type AgentEventHandler = (event: AgentEvent) => void;

export interface TutorSessionRuntime {
  start(): Promise<void>;
  dispose(): Promise<void>;
  subscribe(handler: AgentEventHandler): () => void;
  getHistory(): AgentEvent[];
}

interface DummyRuntimeOptions {
  sessionId: string;
}

/**
 * DummyTutorSessionRuntime emits a fixed set of events to simulate Pi からの出力。
 * 将来ここを AgentSessionRuntime で置き換える。
 */
export class DummyTutorSessionRuntime implements TutorSessionRuntime {
  private readonly handlers = new Set<AgentEventHandler>();

  private readonly history: AgentEvent[] = [];

  private readonly sessionId: string;

  constructor(options: DummyRuntimeOptions) {
    this.sessionId = options.sessionId;
  }

  async start(): Promise<void> {
    const events: AgentEvent[] = [
      {
        type: 'editor.action.request',
        sessionId: this.sessionId,
        turnId: 'turn-1',
        actionId: 'demo-highlight',
        source: 'assistant',
        action: {
          type: 'reveal_range',
          path: 'src/example.ts',
          startLine: 1,
          endLine: 6,
          focusMode: 'soft',
          reason: 'デモ: parse 関数を示す',
        },
      },
      {
        type: 'teaching.turn',
        sessionId: this.sessionId,
        turnId: 'turn-1',
        payload: {
          mode: 'selection',
          headline: 'parse は入力の前後空白を削除して返します',
          summary: '空文字は "empty"、それ以外は Prefix:xxx として返します。',
          claims: [
            {
              id: 'c1',
              text: '入力が空なら "empty" を返す',
              confidence: 'high',
              evidenceIds: ['ev1'],
            },
            {
              id: 'c2',
              text: '空でない場合は trim した文字列に Prefix を付ける',
              confidence: 'high',
              evidenceIds: ['ev1'],
            },
          ],
          evidence: [
            {
              evidenceId: 'ev1',
              path: 'src/example.ts',
              startLine: 1,
              endLine: 8,
              kind: 'selection',
              snippet: 'export function parse(input: string) { ... }',
            },
          ],
          uiActions: [
            {
              type: 'reveal_range',
              path: 'src/example.ts',
              startLine: 1,
              endLine: 6,
              focusMode: 'soft',
              reason: 'parse 関数の本体を示します',
            },
          ],
          nextBestOptions: [
            {
              id: 'n1',
              label: '呼び出し元を見る',
              why: '入力がどこから来るかを確認',
              action: {
                type: 'show_reference_list',
                symbolId: 'sym-parse',
                title: 'parse callers',
              },
            },
          ],
        },
      },
    ];

    for (const event of events) {
      this.push(event);
    }
  }

  async dispose(): Promise<void> {
    this.handlers.clear();
  }

  subscribe(handler: AgentEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  getHistory(): AgentEvent[] {
    return [...this.history];
  }

  private push(event: AgentEvent) {
    this.history.push(event);
    for (const handler of this.handlers) {
      handler(event);
    }
  }
}
