export type ApprovalMode = 'ask_approval' | 'approve_for_me' | 'full_access';

export type AgentStatus =
  | 'idle'
  | 'preparing'
  | 'observing'
  | 'thinking'
  | 'validating'
  | 'awaiting_approval'
  | 'acting'
  | 'verifying'
  | 'completed'
  | 'paused'
  | 'needs_user'
  | 'stopped'
  | 'failed';

export type ActionType = 'click' | 'double_click' | 'type' | 'key_press' | 'scroll' | 'wait' | 'verify' | 'shell';

export interface ActionVerification {
  readonly status: 'verified_success' | 'stalled_no_change' | 'error_dialog_detected' | 'human_intervention_needed';
  readonly visualDeltaPercent: number;
  readonly summary: string;
  readonly recoverySuggestion?: string;
  readonly verifiedAt: number;
}

export interface AgentAction {
  id: string;
  type: ActionType;
  description: string;
  target?: string;
  coordinates?: { x: number; y: number };
  text?: string;
  timestamp: string;
  status: 'pending' | 'awaiting_approval' | 'executed' | 'rejected' | 'failed';
  riskLevel?: 'safe' | 'medium' | 'high';
  verification?: ActionVerification;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  actions?: AgentAction[];
  verificationImage?: string;
}

export interface RunConfiguration {
  goal: string;
  approvalMode: ApprovalMode;
  maxSteps: number;
  maxMinutes: number;
  screenConsent: boolean;
  isolatedEnvironment: boolean;
  /** Resume a saved mission under a new run instead of starting fresh. */
  resume?: { missionId: string; /** Retry intent added as a phase note; also resets stall streaks. */ note?: string };
}

export interface ClarificationQuestion {
  readonly id: string;
  readonly question: string;
  readonly options: string[];
}

export interface UserHandoff {
  readonly kind: 'verification' | 'login' | 'clarification' | 'manual';
  readonly reason: string;
  readonly questions?: ClarificationQuestion[];
}

export interface ParsedIntent {
  summary: string;
  params: Record<string, string>;
  missing: string[];
  questions?: ClarificationQuestion[];
}

export interface TaskSnapshot {
  runId: string | null;
  revision: number;
  status: AgentStatus;
  goal: string;
  maxSteps: number;
  maxMinutes: number;
  actions: AgentAction[];
  messages: ChatMessage[];
  screenshot: string | null;
  pendingActionId: string | null;
  message: string;
  awaitingCompletion: boolean;
  handoff: UserHandoff | null;
  inputTokens: number;
  outputTokens: number;
  intent: ParsedIntent | null;
  mission: import('./mission').MissionPlan | null;
  groundedElements?: import('./grounding').GroundedElement[];
}
