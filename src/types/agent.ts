export type Confidence = 'high' | 'medium' | 'low';

export type UiAction =
  | {
      type: 'open_file';
      path: string;
      anchorLine?: number;
      focusMode?: 'none' | 'soft' | 'hard';
      reason: string;
    }
  | {
      type: 'reveal_range';
      path: string;
      startLine: number;
      endLine: number;
      focusMode?: 'none' | 'soft' | 'hard';
      reason: string;
    }
  | {
      type: 'highlight_range';
      path: string;
      startLine: number;
      endLine: number;
      label?: string;
      ephemeral?: boolean;
    }
  | {
      type: 'show_reference_list';
      symbolId: string;
      title: string;
    }
  | {
      type: 'queue_tour';
      steps: Array<{
        path: string;
        startLine: number;
        endLine: number;
        title: string;
        reason: string;
      }>;
    };

export interface EvidenceRef {
  evidenceId: string;
  path: string;
  startLine: number;
  endLine: number;
  kind:
    | 'selection'
    | 'definition'
    | 'caller'
    | 'callee'
    | 'reference'
    | 'test'
    | 'config'
    | 'doc';
  symbolId?: string;
  snippet: string;
}

export interface TeachingClaim {
  id: string;
  text: string;
  confidence: Confidence;
  evidenceIds: string[];
  inference?: boolean;
}

export interface TeachingTurnPayload {
  mode: 'selection' | 'trace' | 'architecture' | 'comparison' | 'quiz';
  headline: string;
  summary: string;
  claims: TeachingClaim[];
  evidence: EvidenceRef[];
  uiActions: UiAction[];
  nextBestOptions: Array<{
    id: string;
    label: string;
    why: string;
    action: UiAction;
  }>;
  glossary?: Array<{
    term: string;
    explanation: string;
    evidenceIds?: string[];
  }>;
  checkQuestion?: {
    prompt: string;
    expectedConcepts: string[];
  };
}

export interface EditorActionRequest {
  type: 'editor.action.request';
  sessionId: string;
  turnId: string;
  actionId: string;
  source: 'assistant';
  action: UiAction;
}

export interface EditorActionApplied {
  type: 'editor.action.applied';
  sessionId: string;
  turnId: string;
  actionId: string;
  status: 'applied' | 'rejected';
  reason?: string;
}

export type AgentEvent =
  | EditorActionRequest
  | {
      type: 'teaching.turn';
      sessionId: string;
      turnId: string;
      payload: TeachingTurnPayload;
    };
