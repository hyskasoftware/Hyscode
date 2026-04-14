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
  ContextPriority,
  ContextSource,
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
  SkillScope,
  SkillActivation,
  SkillFrontmatter,
  Skill,
  AgentTaskStatus,
  AgentTask,
} from './types';
export { DEFAULT_HARNESS_CONFIG } from './types';

// ─── Core Modules ───────────────────────────────────────────────────────────
export { Harness } from './harness';
export type { HarnessOptions } from './harness';

export { ContextManager } from './context-manager';
export { ToolRouter } from './tool-router';
export { SkillLoader } from './skill-loader';
export type { SkillLoaderConfig } from './skill-loader';

// ─── Agents ─────────────────────────────────────────────────────────────────
export { getAgentDefinition, getAllAgentDefinitions, getAgentTypes } from './agents';

// ─── Tools ──────────────────────────────────────────────────────────────────
export { getAllBuiltinTools } from './tools';

// ─── SDD Engine ─────────────────────────────────────────────────────────────
export { SddEngine, PlanManager } from './sdd-engine';
export type { SddDatabase, SddEngineConfig } from './sdd-engine';;
