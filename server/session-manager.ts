import { v4 as uuidv4 } from 'uuid';
import { AgentEvent } from '../src/types/agent';
import { DummyTutorSessionRuntime, TutorSessionRuntime } from './agent/runtime';

export interface SessionRecord {
  sessionId: string;
  runtime: TutorSessionRuntime;
  createdAt: Date;
}

export interface SessionManagerOptions {
  onEvent: (sessionId: string, event: AgentEvent) => void;
}

export class SessionManager {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly onEvent: (sessionId: string, event: AgentEvent) => void;

  constructor(options: SessionManagerOptions) {
    this.onEvent = options.onEvent;
  }

  async createSession(): Promise<SessionRecord> {
    const sessionId = uuidv4();
    const runtime = new DummyTutorSessionRuntime({ sessionId });
    runtime.subscribe((event) => this.onEvent(sessionId, event));
    await runtime.start();
    const record: SessionRecord = { sessionId, runtime, createdAt: new Date() };
    this.sessions.set(sessionId, record);
    return record;
  }

  get(sessionId: string): SessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  dispose(sessionId: string): boolean {
    const record = this.sessions.get(sessionId);
    if (!record) {
      return false;
    }
    record.runtime.dispose();
    this.sessions.delete(sessionId);
    return true;
  }
}
