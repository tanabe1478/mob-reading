import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CodeEditor, HighlightRange } from './components/CodeEditor';
import {
  AgentEvent,
  EditorActionApplied,
  EditorActionRequest,
  SelectionContext,
  TeachingTurnPayload,
  TutorTurnInput,
} from './types/agent';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

type WsState = {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastError?: string;
};

function useAgentWebSocket(
  sessionId: string | null,
  onEvent: (event: AgentEvent) => void,
): { state: WsState; socket: WebSocket | null } {
  const [state, setState] = useState<WsState>({ status: 'disconnected' });
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setState({ status: 'disconnected' });
      setSocket(null);
      return;
    }

    const baseUrl = new URL(API_BASE_URL);
    baseUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    baseUrl.pathname = '/ws';
    baseUrl.searchParams.set('sessionId', sessionId);

    const ws = new WebSocket(baseUrl.toString());
    setState({ status: 'connecting' });
    setSocket(ws);

    const handleOpen = () => setState({ status: 'connected' });
    const handleError = () => setState({ status: 'error', lastError: 'WebSocket error' });
    const handleClose = () => setState({ status: 'disconnected' });
    const handleMessage = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as AgentEvent;
        onEvent(parsed);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to parse event', error);
      }
    };

    ws.addEventListener('open', handleOpen);
    ws.addEventListener('error', handleError);
    ws.addEventListener('close', handleClose);
    ws.addEventListener('message', handleMessage);

    return () => {
      ws.removeEventListener('open', handleOpen);
      ws.removeEventListener('error', handleError);
      ws.removeEventListener('close', handleClose);
      ws.removeEventListener('message', handleMessage);
      ws.close();
    };
  }, [sessionId, onEvent]);

  return { state, socket };
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

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectionContext, setSelectionContext] = useState<SelectionContext | null>(null);
  const [currentPath, setCurrentPath] = useState<string>(SAMPLE_FILE_PATH);
  const [highlights, setHighlights] = useState<HighlightRange[]>([]);
  const [teachingTurn, setTeachingTurn] = useState<TeachingTurnPayload | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [turnStatus, setTurnStatus] = useState<string | null>(null);
  const [busyTurn, setBusyTurn] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  const sendAck = useCallback(
    (ack: EditorActionApplied) => {
      const activeSocket = socketRef.current;
      if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
        activeSocket.send(JSON.stringify(ack));
      }
      if (!sessionId) {
        return;
      }
      fetch(`${API_BASE_URL}/api/sessions/${sessionId}/actions/${ack.actionId}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turnId: ack.turnId,
          actionId: ack.actionId,
          status: ack.status,
          reason: ack.reason,
        }),
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to send action ack', error);
      });
    },
    [sessionId],
  );

  const applyAction = useCallback(
    (request: EditorActionRequest) => {
      const { action, actionId } = request;
      if (action.type === 'open_file') {
        setCurrentPath(action.path);
      }
      if (action.type === 'reveal_range' || action.type === 'highlight_range') {
        setCurrentPath(action.path);
        const next: HighlightRange = {
          id: actionId,
          startLine: action.startLine,
          endLine: action.endLine,
          label: action.type === 'highlight_range' ? action.label : action.reason,
        };
        setHighlights((prev) => {
          const other = prev.filter((item) => item.id !== actionId);
          return [...other, next];
        });
      }
      sendAck({
        type: 'editor.action.applied',
        sessionId: request.sessionId,
        turnId: request.turnId,
        actionId: request.actionId,
        status: 'applied',
      });
    },
    [sendAck],
  );

  const handleEvent = useCallback(
    (event: AgentEvent) => {
      if (event.type === 'editor.action.request') {
        applyAction(event);
      }
      if (event.type === 'teaching.turn') {
        setTeachingTurn(event.payload);
      }
    },
    [applyAction],
  );

  const { state: wsState, socket } = useAgentWebSocket(sessionId, handleEvent);

  useEffect(() => {
    socketRef.current = socket ?? null;
  }, [socket]);

  useEffect(() => {
    let mounted = true;
    fetch(`${API_BASE_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => res.json())
      .then((data) => {
        if (mounted) {
          setSessionId(data.sessionId);
        }
      })
      .catch((error) => {
        if (mounted) {
          setApiError(String(error));
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectionChange = useCallback(
    (range: { startLine: number; endLine: number }) => {
      setSelectionContext({
        path: currentPath,
        rawRange: range,
        canonicalRange: range,
      });
    },
    [currentPath],
  );

  const sendUserTurn = useCallback(async () => {
    if (!sessionId) {
      return;
    }
    setBusyTurn(true);
    setTurnStatus('Queuing turn...');
    const payload: TutorTurnInput = {
      message: selectionContext
        ? `Explain lines ${selectionContext.canonicalRange.startLine}-${selectionContext.canonicalRange.endLine}.`
        : 'Explain the current selection.',
      selectionContext:
        selectionContext ?? {
          path: currentPath,
          rawRange: { startLine: 1, endLine: 6 },
          canonicalRange: { startLine: 1, endLine: 6 },
        },
      mode: 'selection',
    };
    try {
      const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/turns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      setTurnStatus(`Turn ${data.turnId} queued`);
    } catch (error) {
      setApiError(String(error));
      setTurnStatus('Failed to queue turn');
    } finally {
      setBusyTurn(false);
    }
  }, [sessionId, selectionContext, currentPath]);

  const highlightChips = useMemo(() => highlights, [highlights]);
  const connectionLabel = sessionId ? `${sessionId.slice(0, 8)}...` : 'starting';

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <strong>Code Reading Tutor (local)</strong>
        </div>
        <div className="badge">
          WS: {wsState.status} ({connectionLabel})
        </div>
      </header>

      <nav className="app-nav">
        <div className="section-title">Workspace</div>
        <div className="card">
          <div>{currentPath}</div>
          {selectionContext && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Selection: {selectionContext.rawRange.startLine}-{selectionContext.rawRange.endLine}
            </div>
          )}
        </div>

        <div className="section-title">Actions</div>
        <button
          type="button"
          className="card"
          onClick={sendUserTurn}
          disabled={!sessionId || busyTurn}
        >
          {busyTurn ? 'Explaining...' : 'Explain selection'}
        </button>
        {turnStatus && <div style={{ fontSize: 12, marginTop: 4 }}>{turnStatus}</div>}
        {apiError && (
          <div style={{ color: '#dc2626', marginTop: 8, fontSize: 12 }}>{apiError}</div>
        )}
      </nav>

      <main className="app-main">
        <div className="section-title">Editor</div>
        <div className="monaco-shell">
          <CodeEditor
            path={currentPath}
            content={SAMPLE_CONTENT}
            highlights={highlightChips}
            onSelectionChange={handleSelectionChange}
          />
        </div>
        <div style={{ marginTop: 8 }}>
          {highlightChips.map((h) => (
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
