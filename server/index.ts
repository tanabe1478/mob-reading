import cors from 'cors';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import { SessionManager } from './session-manager';
import { AgentEvent, EditorActionApplied, TutorTurnInput } from '../src/types/agent';

const PORT = 4000;
const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

class SessionEventHub {
  private readonly registry = new Map<string, Set<WebSocket>>();

  subscribe(sessionId: string, socket: WebSocket): void {
    const clients = this.registry.get(sessionId) ?? new Set<WebSocket>();
    clients.add(socket);
    this.registry.set(sessionId, clients);
  }

  unsubscribe(sessionId: string, socket: WebSocket): void {
    const clients = this.registry.get(sessionId);
    if (!clients) {
      return;
    }
    clients.delete(socket);
    if (clients.size === 0) {
      this.registry.delete(sessionId);
    }
  }

  publish(sessionId: string, event: AgentEvent): void {
    const clients = this.registry.get(sessionId);
    if (!clients) {
      return;
    }
    const payload = JSON.stringify(event);
    for (const socket of clients) {
      if (socket.readyState !== WebSocket.OPEN) {
        continue;
      }
      socket.send(payload);
    }
  }
}

const eventHub = new SessionEventHub();
const sessionManager = new SessionManager({
  onEvent(sessionId, event) {
    eventHub.publish(sessionId, event);
  },
});

app.post('/api/sessions', async (_req, res) => {
  const session = await sessionManager.createSession();
  res.status(201).json({ sessionId: session.sessionId });
});

app.post('/api/sessions/:sessionId/turns', async (req, res) => {
  const { sessionId } = req.params;
  const session = sessionManager.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'session not found' });
  }
  const input = req.body as TutorTurnInput;
  if (!input?.message && !input?.selectionContext) {
    return res.status(400).json({ error: 'message or selectionContext required' });
  }
  const result = await session.runtime.handleUserTurn(input);
  res.status(202).json({ status: 'queued', turnId: result.turnId });
});

app.post('/api/sessions/:sessionId/actions/:actionId/ack', (req, res) => {
  const { sessionId } = req.params;
  const session = sessionManager.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'session not found' });
  }
  const ack = req.body as Partial<EditorActionApplied> & { status: EditorActionApplied['status'] };
  if (!ack.actionId || !ack.turnId || !ack.status) {
    return res.status(400).json({ error: 'missing ack properties' });
  }
  session.runtime.sendActionAck({
    type: 'editor.action.applied',
    sessionId,
    turnId: ack.turnId,
    actionId: ack.actionId,
    status: ack.status,
    reason: ack.reason,
  });
  res.status(204).send();
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (socket, request) => {
  const url = new URL(request.url ?? '', 'http://localhost');
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) {
    socket.close(1008, 'sessionId query parameter required');
    return;
  }
  const session = sessionManager.get(sessionId);
  if (!session) {
    socket.close(4003, 'session not found');
    return;
  }

  eventHub.subscribe(sessionId, socket);
  for (const event of session.runtime.getHistory()) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
    }
  }

  socket.on('close', () => {
    eventHub.unsubscribe(sessionId, socket);
  });
});

server.listen(PORT, () => {
  const cwd = path.resolve('.');
  // eslint-disable-next-line no-console
  console.log(`Local API/WS listening on http://localhost:${PORT} (cwd=${cwd})`);
});
