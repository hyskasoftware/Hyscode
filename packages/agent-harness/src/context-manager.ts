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
  Skill,
  AgentDefinition,
} from './types';

const PRIORITY_ORDER: ContextPriority[] = ['always', 'high', 'medium', 'low'];

export class ContextManager {
  private sources: ContextSource[] = [];
  private conversationHistory: Message[] = [];
  private activeSkills: Skill[] = [];
  private allSkills: Skill[] = [];
  private agentDef: AgentDefinition | null = null;
  private systemPromptOverride: string | null = null;

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

    // Skill directory: list ALL available skills so the agent knows what it can activate
    const inactiveSkills = this.allSkills.filter(s => !s.active);
    if (inactiveSkills.length > 0) {
      parts.push('\n<available_skills>');
      parts.push('The following skills are available but not yet activated. Use `activate_skill` to enable any that are relevant to the current task:');
      for (const skill of inactiveSkills) {
        parts.push(`- **${skill.frontmatter.name}**: ${skill.frontmatter.description}`);
      }
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

    // Step 3: Fill remaining budget with older conversation history
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

    // Combine: older history → context → must-include
    return [...includedOlder, ...contextMessages, ...mustInclude];
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
