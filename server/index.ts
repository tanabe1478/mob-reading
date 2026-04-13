import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { DummyTutorSessionRuntime } from './agent/runtime';
import { AgentEvent, EditorActionApplied } from '../src/types/agent';

const PORT = 4000;

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const sockets = new Set<WebSocket>();

const runtime = new DummyTutorSessionRuntime({ sessionId: 'demo' });

const broadcast = (event: AgentEvent) => {
  const payload = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
};

runtime.subscribe(broadcast);
runtime.start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start runtime', error);
});

wss.on('connection', (socket) => {
  sockets.add(socket);

  // Replay history so新しい接続でもデモが見える。
  for (const event of runtime.getHistory()) {
    socket.send(JSON.stringify(event));
  }

  socket.on('message', (data) => {
    try {
      const ack = JSON.parse(data.toString()) as EditorActionApplied;
      // eslint-disable-next-line no-console
      console.log('Ack from client', ack);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse WS message', error);
    }
  });

  socket.on('close', () => {
    sockets.delete(socket);
  });
});

server.listen(PORT, () => {
  const cwd = path.resolve('.');
  // eslint-disable-next-line no-console
  console.log(`Local API/WS listening on http://localhost:${PORT} (cwd=${cwd})`);
});
