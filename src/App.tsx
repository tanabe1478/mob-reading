import { useEffect, useMemo, useState } from 'react';
import { CodeEditor, HighlightRange } from './components/CodeEditor';
import {
  AgentEvent,
  EditorActionApplied,
  EditorActionRequest,
  TeachingTurnPayload,
  UiAction,
} from './types/agent';

interface WsState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastError?: string;
}

const SAMPLE_FILE_PATH = 'src/example.ts';
const SAMPLE_CONTENT = `export function parse(input: string): string {
  if (!input) {
    return 'empty';
  }
  const trimmed = input.trim();
  return \`Prefix:\${trimmed}\`;
}

export function main() {
  const result = parse('hello');
  console.log(result);
}
`;

function useAgentWebSocket(
  onEvent: (event: AgentEvent) => void,
): { state: WsState; socket: WebSocket | null } {
  const [state, setState] = useState<WsState>({ status: 'disconnected' });
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const instance = new WebSocket('ws://localhost:4000/ws');
    setState({ status: 'connecting' });
    setSocket(instance);

    instance.onopen = () => setState({ status: 'connected' });
    instance.onerror = () => setState({ status: 'error', lastError: 'socket error' });
    instance.onclose = () => setState({ status: 'disconnected' });
    instance.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as AgentEvent;
        onEvent(parsed);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to parse agent event', error);
      }
    };

    return () => instance.close();
  }, [onEvent]);

  return { state, socket };
}

function actionToHighlight(action: UiAction, actionId: string): HighlightRange | null {
  if (action.type === 'highlight_range' || action.type === 'reveal_range') {
    return {
      id: actionId,
      startLine: action.startLine,
      endLine: action.endLine,
      label: action.type === 'highlight_range' ? action.label : action.reason,
    };
  }
  return null;
}

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(SAMPLE_FILE_PATH);
  const [content] = useState<string>(SAMPLE_CONTENT);
  const [highlights, setHighlights] = useState<HighlightRange[]>([]);
  const [teachingTurn, setTeachingTurn] = useState<TeachingTurnPayload | null>(null);

  const { state: wsState, socket } = useAgentWebSocket((event) => {
    if (event.type === 'editor.action.request') {
      applyAction(event);
    }
    if (event.type === 'teaching.turn') {
      setTeachingTurn(event.payload);
    }
  });

  const applyAction = (request: EditorActionRequest) => {
    const { action, actionId } = request;
    if (action.type === 'open_file') {
      setCurrentPath(action.path);
    }
    if (action.type === 'reveal_range' || action.type === 'highlight_range') {
      setCurrentPath(action.path);
      const next = actionToHighlight(action, actionId);
      if (next) {
        setHighlights((prev) => {
          const other = prev.filter((item) => item.id !== actionId);
          return [...other, next];
        });
      }
    }
    sendAck({
      type: 'editor.action.applied',
      sessionId: request.sessionId,
      turnId: request.turnId,
      actionId: request.actionId,
      status: 'applied',
    });
  };

  const sendAck = (ack: EditorActionApplied) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(ack));
    }
  };

  const sampleAction: EditorActionRequest = useMemo(
    () => ({
      type: 'editor.action.request',
      sessionId: 'sample',
      turnId: 't1',
      actionId: 'a1',
      source: 'assistant',
      action: {
        type: 'reveal_range',
        path: SAMPLE_FILE_PATH,
        startLine: 1,
        endLine: 6,
        focusMode: 'soft',
        reason: 'サンプル: parse 関数を示す',
      },
    }),
    [],
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <strong>Code Reading Tutor (local)</strong>
        </div>
        <div className="badge">WS: {wsState.status}</div>
      </header>

      <nav className="app-nav">
        <div className="section-title">Workspace</div>
        <div className="card">
          <div>{currentPath}</div>
        </div>

        <div className="section-title">Actions</div>
        <button type="button" className="card" onClick={() => applyAction(sampleAction)}>
          サンプルの AI ハイライトを適用
        </button>
      </nav>

      <main className="app-main">
        <div className="section-title">Editor</div>
        <div className="monaco-shell">
          <CodeEditor path={currentPath} content={content} highlights={highlights} />
        </div>
        <div style={{ marginTop: 8 }}>
          {highlights.map((h) => (
            <span key={h.id} className="highlight-chip">
              {h.label ?? `Lines ${h.startLine}-${h.endLine}`}
            </span>
          ))}
        </div>
      </main>

      <aside className="app-side">
        <div className="section-title">Tutor Panel</div>
        {teachingTurn ? (
          <div className="card">
            <div style={{ fontWeight: 700 }}>{teachingTurn.headline}</div>
            <p>{teachingTurn.summary}</p>
            <div className="section-title" style={{ marginTop: 8 }}>
              Claims
            </div>
            <ul className="list">
              {teachingTurn.claims.map((claim) => (
                <li key={claim.id}>
                  <div style={{ fontWeight: 600 }}>{claim.text}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    confidence: {claim.confidence}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="card">AI からの説明はまだありません。</div>
        )}
      </aside>
    </div>
  );
}
