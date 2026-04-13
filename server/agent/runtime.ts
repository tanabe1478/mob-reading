import { AgentEvent, EditorActionApplied, SelectionContext, TeachingTurnPayload, TutorTurnInput } from '../../src/types/agent';

export type AgentEventHandler = (event: AgentEvent) => void;

export interface TutorSessionRuntime {
  start(): Promise<void>;
  dispose(): Promise<void>;
  subscribe(handler: AgentEventHandler): () => void;
  getHistory(): AgentEvent[];
  handleUserTurn(input: TutorTurnInput): Promise<{ turnId: string }>;
  sendActionAck(ack: EditorActionApplied): void;
}

interface DummyTutorSessionOptions {
  sessionId: string;
}

export class DummyTutorSessionRuntime implements TutorSessionRuntime {
  private readonly handlers = new Set<AgentEventHandler>();
  private readonly history: AgentEvent[] = [];
  private turnCounter = 0;
  private readonly sessionId: string;

  constructor(options: DummyTutorSessionOptions) {
    this.sessionId = options.sessionId;
  }

  async start(): Promise<void> {
    this.turnCounter = 0;
    await this.emitInitialEvents();
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

  async handleUserTurn(input: TutorTurnInput): Promise<{ turnId: string }> {
    const turnId = `turn-${++this.turnCounter}`;
    await this.emitSelectionHighlight(turnId, input.selectionContext);
    this.push({
      type: 'teaching.turn',
      sessionId: this.sessionId,
      turnId,
      payload: this.buildTeachingTurnPayload(input, turnId),
    });
    return { turnId };
  }

  sendActionAck(ack: EditorActionApplied): void {
    // noop for dummy runtime, but keep log for debugging
    // eslint-disable-next-line no-console
    console.log('Dummy runtime ack', ack);
  }

  private async emitInitialEvents(): Promise<void> {
    const initialPath = 'src/example.ts';
    const turnId = `turn-${++this.turnCounter}`;
    const selection: SelectionContext = {
      path: initialPath,
      rawRange: { startLine: 1, endLine: 6 },
      canonicalRange: { startLine: 1, endLine: 6 },
    };
    await this.emitSelectionHighlight(turnId, selection);
    this.push({
      type: 'teaching.turn',
      sessionId: this.sessionId,
      turnId,
      payload: this.buildTeachingTurnPayload({ message: 'Explain the parser entry point.', selectionContext: selection }, turnId),
    });
  }

  private buildTeachingTurnPayload(input: TutorTurnInput, turnId: string): TeachingTurnPayload {
    const selection = input.selectionContext;
    const path = selection?.path ?? 'src/example.ts';
    const headline = selection
      ? `Explain ${path}:${selection.canonicalRange.startLine}-${selection.canonicalRange.endLine}`
      : 'Explain the highlighted region';
    const summary = input.message ?? 'Here is the current selection you asked about.';
    const highlightRange = selection?.canonicalRange ?? { startLine: 1, endLine: 6 };
    const uiActions = [
      {
        type: 'reveal_range' as const,
        path,
        startLine: highlightRange.startLine,
        endLine: highlightRange.endLine,
        focusMode: 'soft' as const,
        reason: 'Illustrate the selection',
      },
    ];
    const evidence: TeachingTurnPayload['evidence'] = [
      {
        evidenceId: `ev-${turnId}`,
        path,
        startLine: highlightRange.startLine,
        endLine: highlightRange.endLine,
        kind: 'selection',
        snippet: 'function parse(...) { ... }',
      },
    ];
    return {
      mode: input.mode ?? 'selection',
      headline,
      summary,
      claims: [
        {
          id: `c-${turnId}-1`,
          text: `Lines ${highlightRange.startLine}-${highlightRange.endLine} define the parser entry point.`,
          confidence: 'high',
          evidenceIds: evidence.map((item) => item.evidenceId),
        },
      ],
      evidence,
      uiActions,
      nextBestOptions: [
        {
          id: `n-${turnId}-1`,
          label: 'View parse callers',
          why: 'Understand how this entry point is invoked.',
          action: {
            type: 'show_reference_list',
            symbolId: 'sym-parse',
            title: 'parse() callers',
          },
        },
      ],
      glossary: [
        {
          term: 'parser entry',
          explanation: 'The parse function transforms the token stream and builds the AST.',
          evidenceIds: evidence.map((item) => item.evidenceId),
        },
      ],
      checkQuestion: {
        prompt: 'What is the parser entry responsible for?',
        expectedConcepts: ['token stream', 'AST'],
      },
    };
  }

  private async emitSelectionHighlight(turnId: string, selection?: SelectionContext): Promise<void> {
    const path = selection?.path ?? 'src/example.ts';
    const range = selection?.canonicalRange ?? { startLine: 1, endLine: 6 };
    this.push({
      type: 'editor.action.request',
      sessionId: this.sessionId,
      turnId,
      actionId: `highlight-${turnId}`,
      source: 'assistant',
      action: {
        type: 'reveal_range',
        path,
        startLine: range.startLine,
        endLine: range.endLine,
        focusMode: 'soft',
        reason: 'Guide the user to the highlighted selection',
      },
    });
  }

  private push(event: AgentEvent): void {
    this.history.push(event);
    for (const handler of this.handlers) {
      handler(event);
    }
  }
}
