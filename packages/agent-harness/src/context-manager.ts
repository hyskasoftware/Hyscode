// ─── Context Manager ────────────────────────────────────────────────────────
// Assembles the context window sent to the LLM, managing token budgets.

import type { Message, ToolDefinition } from '@hyscode/ai-providers';
import {
  estimateMessageTokens,
  estimateToolDefinitionTokens,
  estimateSystemPromptTokens,
} from '@hyscode/ai-providers';
import type {
  ContextSource,
  ContextSnapshot,
  TokenBudget,
  ContextPriority,
  GatheredContextEntry,
  Skill,
  AgentDefinition,
  Rule,
} from './types';

const PRIORITY_ORDER: ContextPriority[] = ['always', 'high', 'medium', 'low'];

/** Max fraction of available tokens that gathered context can consume. */
const GATHERED_CONTEXT_BUDGET_FRACTION = 0.3;

export class ContextManager {
  private sources: ContextSource[] = [];
  private conversationHistory: Message[] = [];
  private activeSkills: Skill[] = [];
  private allSkills: Skill[] = [];
  private activeRules: Rule[] = [];
  private agentDef: AgentDefinition | null = null;
  private systemPromptOverride: string | null = null;

  // ─── Gathered Context (agent-managed) ─────────────────────────────
  // Files the agent autonomously decides are important to keep in context.
  // Indexed by absolute file path. Survives across iterations within a turn.
  private gatheredFiles = new Map<string, GatheredContextEntry>();

  // ─── Configuration ──────────────────────────────────────────────────

  setAgent(agent: AgentDefinition): void {
    this.agentDef = agent;
  }

  setSystemPrompt(prompt: string): void {
    this.systemPromptOverride = prompt;
  }

  setActiveSkills(skills: Skill[]): void {
    this.activeSkills = skills;
  }

  setAllSkills(skills: Skill[]): void {
    this.allSkills = skills;
  }

  setActiveRules(rules: Rule[]): void {
    this.activeRules = rules;
  }

  // ─── Context Sources ────────────────────────────────────────────────

  addSource(source: ContextSource): void {
    // Replace existing source with same ID
    this.sources = this.sources.filter((s) => s.id !== source.id);
    this.sources.push(source);
  }

  removeSource(id: string): void {
    this.sources = this.sources.filter((s) => s.id !== id);
  }

  clearSources(): void {
    this.sources = [];
  }

  // ─── Gathered Context (Agent-Managed) ───────────────────────────────

  /**
   * Add a file to gathered context. If already gathered, updates content and relevance.
   * Returns the token estimate for the gathered file.
   */
  addGatheredFile(path: string, content: string, relevance: number, reason: string): number {
    const tokenEstimate = Math.ceil(content.length / 4);
    this.gatheredFiles.set(path, {
      path,
      content,
      relevance: Math.max(0, Math.min(1, relevance)),
      reason,
      tokenEstimate,
      gatheredAt: new Date().toISOString(),
    });
    return tokenEstimate;
  }

  /** Remove a file from gathered context. Returns true if it existed. */
  removeGatheredFile(path: string): boolean {
    return this.gatheredFiles.delete(path);
  }

  /** Get all gathered files, sorted by relevance (highest first). */
  getGatheredFiles(): GatheredContextEntry[] {
    return Array.from(this.gatheredFiles.values())
      .sort((a, b) => b.relevance - a.relevance);
  }

  /** Clear all gathered files. */
  clearGatheredFiles(): void {
    this.gatheredFiles.clear();
  }

  /** Check if a file is already gathered. */
  hasGatheredFile(path: string): boolean {
    return this.gatheredFiles.has(path);
  }

  /** Get total tokens used by gathered files. */
  getGatheredTokens(): number {
    let total = 0;
    for (const entry of this.gatheredFiles.values()) {
      total += entry.tokenEstimate;
    }
    return total;
  }

  // ─── Conversation History ───────────────────────────────────────────

  setHistory(messages: Message[]): void {
    this.conversationHistory = messages;
  }

  addMessage(message: Message): void {
    this.conversationHistory.push(message);
  }

  getHistory(): Message[] {
    return this.conversationHistory;
  }

  // ─── Build Context Snapshot ─────────────────────────────────────────

  buildSnapshot(
    tools: ToolDefinition[],
    maxInputTokens: number,
    maxOutputTokens: number,
  ): ContextSnapshot {
    console.log('[ContextManager] buildSnapshot history roles:', JSON.stringify(this.conversationHistory.map(m => m.role)));
    const systemPrompt = this.buildSystemPrompt();
    const systemTokens = estimateSystemPromptTokens(systemPrompt);
    const toolTokens = estimateToolDefinitionTokens(tools);

    const budget: TokenBudget = {
      maxInput: maxInputTokens,
      maxOutput: maxOutputTokens,
      reserved: {
        systemPrompt: systemTokens,
        toolDefinitions: toolTokens,
        responseBuffer: Math.min(4096, maxOutputTokens),
      },
      available: maxInputTokens - systemTokens - toolTokens - Math.min(4096, maxOutputTokens),
    };

    // Build messages within budget
    const messages = this.buildMessages(budget.available);

    const totalTokens =
      systemTokens + toolTokens + estimateMessageTokens(messages);

    return {
      systemPrompt,
      messages,
      tools,
      totalTokens,
      budget,
    };
  }

  // ─── System Prompt Construction ─────────────────────────────────────

  private buildSystemPrompt(): string {
    const parts: string[] = [];

    // Base agent prompt
    if (this.systemPromptOverride) {
      parts.push(this.systemPromptOverride);
    } else if (this.agentDef) {
      parts.push(this.agentDef.basePrompt);
    }

    // Active rules (injected before skills — higher precedence)
    if (this.activeRules.length > 0) {
      parts.push('\n<active_rules>');
      parts.push('CRITICAL: Read and follow EVERY rule below before taking any action. Rules override default behavior.');
      for (const rule of this.activeRules) {
        parts.push(`<rule name="${rule.name}" scope="${rule.scope}">\n${rule.content}\n</rule>`);
      }
      parts.push('</active_rules>');
    }

    // Context sources marked as 'always' priority
    const alwaysSources = this.sources.filter((s) => s.priority === 'always');
    if (alwaysSources.length > 0) {
      parts.push('\n<context>');
      for (const source of alwaysSources) {
        parts.push(`<${source.type}>\n${source.content}\n</${source.type}>`);
      }
      parts.push('</context>');
    }

    // Active skills (full content injected into context)
    if (this.activeSkills.length > 0) {
      parts.push('\n<active_skills>');
      for (const skill of this.activeSkills) {
        parts.push(`<skill name="${skill.frontmatter.name}">\n${skill.content}\n</skill>`);
      }
      parts.push('</active_skills>');
    }

    // Skill directory: compact listing of available skills.
    // Instead of dumping full descriptions of every inactive skill (which causes
    // context rot), we use progressive disclosure: a one-liner list so the agent
    // knows what exists, and the `list_skills` tool for full details.
    const inactiveSkills = this.allSkills.filter(s => !s.active);
    if (inactiveSkills.length > 0) {
      const names = inactiveSkills.map(s => s.frontmatter.name).join(', ');
      parts.push(`\n<available_skills count="${inactiveSkills.length}">`);
      parts.push(`Available but inactive: ${names}`);
      parts.push('Use `list_skills` for details or `activate_skill` to enable one.');
      parts.push('</available_skills>');
    }

    return parts.join('\n');
  }

  // ─── Message Construction ───────────────────────────────────────────

  private buildMessages(availableTokens: number): Message[] {
    let remaining = availableTokens;

    // Step 1: Always include the last 2 messages (user question + any assistant response)
    const mustInclude = this.conversationHistory.slice(-2);
    const mustIncludeTokens = estimateMessageTokens(mustInclude);
    remaining -= mustIncludeTokens;

    if (remaining <= 0) {
      // Even the last messages exceed budget — truncate them
      return this.truncateMessages(mustInclude, availableTokens);
    }

    // Step 2: Add context sources by priority (non-always)
    const contextMessages: Message[] = [];
    const nonAlwaysSources = this.sources
      .filter((s) => s.priority !== 'always')
      .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));

    for (const source of nonAlwaysSources) {
      if (source.tokenEstimate <= remaining) {
        contextMessages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: `[Context: ${source.type}]\n${source.content}`,
            },
          ],
        });
        remaining -= source.tokenEstimate;
      }
    }

    // Step 3: Add gathered files (agent-managed context) within sub-budget
    const gatheredMessages: Message[] = [];
    if (this.gatheredFiles.size > 0) {
      const gatheredBudget = Math.floor(availableTokens * GATHERED_CONTEXT_BUDGET_FRACTION);
      let gatheredUsed = 0;

      // Sort by relevance (highest first) so most important files are kept
      const sorted = this.getGatheredFiles();

      const fileParts: string[] = [];
      for (const entry of sorted) {
        if (gatheredUsed + entry.tokenEstimate > gatheredBudget) continue;
        if (entry.tokenEstimate > remaining) continue;
        fileParts.push(
          `<gathered_file path="${entry.path}" relevance="${entry.relevance.toFixed(2)}" reason="${entry.reason}">\n${entry.content}\n</gathered_file>`
        );
        gatheredUsed += entry.tokenEstimate;
        remaining -= entry.tokenEstimate;
      }

      if (fileParts.length > 0) {
        gatheredMessages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: `[Gathered Context: ${fileParts.length} file(s) in agent working memory]\n<gathered_context>\n${fileParts.join('\n')}\n</gathered_context>`,
            },
          ],
        });
      }
    }

    // Step 4: Fill remaining budget with older conversation history
    const olderHistory = this.conversationHistory.slice(0, -2);
    const includedOlder: Message[] = [];

    // Walk backwards from most recent older messages
    for (let i = olderHistory.length - 1; i >= 0; i--) {
      const msg = olderHistory[i];
      const tokens = estimateMessageTokens([msg]);
      if (tokens <= remaining) {
        includedOlder.unshift(msg);
        remaining -= tokens;
      } else {
        break; // Stop at first message that doesn't fit
      }
    }

    // Combine: gathered context → user context → older history → must-include
    //
    // IMPORTANT: context/gathered messages MUST come BEFORE older history, never
    // between history and mustInclude. When a prior turn ended with a tool_result
    // as the last message (e.g. max_iterations or empty finalResponse), mustInclude
    // starts with that tool_result and its paired assistant+tool_calls is at the end
    // of includedOlder. Inserting any role:'user' context messages between them
    // causes OpenAI/OpenRouter to reject with:
    // "An assistant message with 'tool_calls' must be followed by tool messages"
    const combined = [...gatheredMessages, ...contextMessages, ...includedOlder, ...mustInclude];
    console.log('[ContextManager] buildMessages combined roles:', JSON.stringify(combined.map(m => m.role)));

    // Ensure the first message has role 'user'. Anthropic (and others) reject
    // conversations that start with an assistant message. This can happen when
    // mustInclude is [assistant, tool] (after a tool-use iteration) and the
    // original user message was dropped from olderHistory due to budget limits.
    if (combined.length > 0 && combined[0].role !== 'user') {
      // Find the original user message in olderHistory (should be first)
      const firstUser = this.conversationHistory.find(m => m.role === 'user');
      if (firstUser && !combined.includes(firstUser)) {
        combined.unshift(firstUser);
      }
    }

    return combined;
  }

  private truncateMessages(messages: Message[], maxTokens: number): Message[] {
    // Simple truncation: trim content of messages to fit
    const result: Message[] = [];
    let used = 0;

    for (const msg of messages) {
      const tokens = estimateMessageTokens([msg]);
      if (used + tokens <= maxTokens) {
        result.push(msg);
        used += tokens;
      } else {
        // Truncate this message's text content
        const remainingTokens = maxTokens - used;
        const charBudget = remainingTokens * 4; // rough estimate
        const truncated: Message = {
          ...msg,
          content: msg.content.map((c) => {
            if (c.type === 'text' && c.text.length > charBudget) {
              return {
                ...c,
                text: c.text.slice(0, charBudget) + '\n... [truncated]',
              };
            }
            return c;
          }),
        };
        result.push(truncated);
        break;
      }
    }

    return result;
  }
}
