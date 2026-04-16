// ─── Types ──────────────────────────────────────────────────────────────────
export type {
  ToolCategory,
  ToolResult,
  ToolHandler,
  ToolExecutionContext,
  ToolCallRecord,
  ApprovalMode,
  ApprovalConfig,
  PendingToolCall,
  ToolRiskLevel,
  ContextPriority,
  ContextSource,
  GatheredContextEntry,
  TokenBudget,
  ContextSnapshot,
  AgentType,
  AgentDefinition,
  ConversationMode,
  Conversation,
  SddStatus,
  SddTaskStatus,
  SddSession,
  SddTask,
  HarnessConfig,
  HarnessEvent,
  HarnessEventHandler,
  FileChangePending,
  ModeSwitchRequest,
  AgentQuestion,
  AgentQuestionOption,
  AgentQuestionAnswer,
  SkillScope,
  SkillActivation,
  SkillFrontmatter,
  Skill,
  SkillStatus,
  AgentTaskStatus,
  AgentTask,
  TurnRecord,
  EnvironmentContext,
} from './types';
export { DEFAULT_HARNESS_CONFIG, SAFE_TOOLS, DESTRUCTIVE_TOOLS, CATEGORY_RISK } from './types';

// ─── Core Modules ───────────────────────────────────────────────────────────
export { Harness } from './harness';
export type { HarnessOptions } from './harness';

export { ContextManager } from './context-manager';
export { ToolRouter } from './tool-router';
export { SkillLoader } from './skill-loader';
export type { SkillLoaderConfig } from './skill-loader';

// ─── Middleware ──────────────────────────────────────────────────────────────
export type { MiddlewareContext, PreCompletionHook, PostToolHook } from './middleware';
export { verificationMiddleware, LoopDetectionMiddleware, compactToolOutput } from './middleware';

// ─── Agents ─────────────────────────────────────────────────────────────────
export { getAgentDefinition, getAllAgentDefinitions, getAgentTypes } from './agents';

// ─── Tools ──────────────────────────────────────────────────────────────────
export { getAllBuiltinTools } from './tools';

// ─── SDD Engine ─────────────────────────────────────────────────────────────
export { SddEngine, PlanManager } from './sdd-engine';
export type { SddDatabase, SddEngineConfig } from './sdd-engine';

// ─── Tracing ────────────────────────────────────────────────────────────────
export { TraceRecorder, analyzeTraces } from './trace-recorder';
export type { Trace, TraceIteration, TraceAnalysisSummary } from './trace-recorder';

// ─── Mode Policies ──────────────────────────────────────────────────────────
export {
  getModePolicy,
  getAllModePolicies,
  getDefaultPolicy,
  applyPolicyOverride,
  resetPolicy,
  resetAllPolicies,
  adjustPolicyForModel,
  getModelProfile,
} from './mode-policies';
export type { ModePolicy, ModelProfile } from './mode-policies';
