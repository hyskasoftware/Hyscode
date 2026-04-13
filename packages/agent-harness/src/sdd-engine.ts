// ─── SDD Engine ─────────────────────────────────────────────────────────────
// Spec-Driven Development workflow: describe → spec → plan → execute → review.

import type {
  SddSession,
  SddTask,
  SddStatus,
  SddTaskStatus,
  HarnessEventHandler,
} from './types';

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ─── Database Interface ─────────────────────────────────────────────────────
// Abstraction over SQLite calls via Tauri.

export interface SddDatabase {
  createSession(session: SddSession): Promise<void>;
  updateSession(id: string, updates: Partial<SddSession>): Promise<void>;
  getSession(id: string): Promise<SddSession | null>;
  listSessions(projectId: string): Promise<SddSession[]>;

  createTask(task: SddTask): Promise<void>;
  updateTask(id: string, updates: Partial<SddTask>): Promise<void>;
  getTasksForSession(sessionId: string): Promise<SddTask[]>;
}

// ─── Plan Manager ───────────────────────────────────────────────────────────
// Manages SDD task state and persistence.

export class PlanManager {
  private db: SddDatabase;

  constructor(db: SddDatabase) {
    this.db = db;
  }

  async createSession(projectId: string, description: string): Promise<SddSession> {
    const session: SddSession = {
      id: generateId(),
      projectId,
      description,
      spec: null,
      specApproved: false,
      tasks: [],
      status: 'describing',
      createdAt: now(),
      updatedAt: now(),
    };
    await this.db.createSession(session);
    return session;
  }

  async getSession(id: string): Promise<SddSession | null> {
    const session = await this.db.getSession(id);
    if (session) {
      session.tasks = await this.db.getTasksForSession(id);
    }
    return session;
  }

  async updateSpec(sessionId: string, spec: string): Promise<void> {
    await this.db.updateSession(sessionId, {
      spec,
      status: 'specifying',
      updatedAt: now(),
    });
  }

  async approveSpec(sessionId: string): Promise<void> {
    await this.db.updateSession(sessionId, {
      specApproved: true,
      status: 'planning',
      updatedAt: now(),
    });
  }

  async setTasks(sessionId: string, tasks: Array<{ title: string; description: string; files: string[]; dependencies: string[] }>): Promise<SddTask[]> {
    const sddTasks: SddTask[] = tasks.map((t, i) => ({
      id: generateId(),
      sessionId,
      ordinal: i + 1,
      title: t.title,
      description: t.description,
      files: t.files,
      dependencies: t.dependencies,
      status: 'pending' as SddTaskStatus,
      agentOutput: null,
      toolCalls: [],
      createdAt: now(),
      updatedAt: now(),
    }));

    for (const task of sddTasks) {
      await this.db.createTask(task);
    }

    await this.db.updateSession(sessionId, {
      status: 'planning',
      updatedAt: now(),
    });

    return sddTasks;
  }

  async approvePlan(sessionId: string): Promise<void> {
    await this.db.updateSession(sessionId, {
      status: 'executing',
      updatedAt: now(),
    });
  }

  async updateTaskStatus(taskId: string, status: SddTaskStatus, agentOutput?: string): Promise<void> {
    await this.db.updateTask(taskId, {
      status,
      agentOutput: agentOutput ?? undefined,
      updatedAt: now(),
    });
  }

  async completeSession(sessionId: string): Promise<void> {
    await this.db.updateSession(sessionId, {
      status: 'completed',
      updatedAt: now(),
    });
  }

  async cancelSession(sessionId: string): Promise<void> {
    await this.db.updateSession(sessionId, {
      status: 'cancelled',
      updatedAt: now(),
    });
  }

  /** Get the next executable task (all dependencies completed) */
  async getNextTask(sessionId: string): Promise<SddTask | null> {
    const tasks = await this.db.getTasksForSession(sessionId);
    const completedIds = new Set(
      tasks.filter((t) => t.status === 'completed').map((t) => t.id),
    );

    for (const task of tasks) {
      if (task.status !== 'pending') continue;
      const depsReady = task.dependencies.every((dep) => completedIds.has(dep));
      if (depsReady) return task;
    }

    return null;
  }

  /** Check if all tasks are done */
  async isComplete(sessionId: string): Promise<boolean> {
    const tasks = await this.db.getTasksForSession(sessionId);
    return tasks.every((t) => t.status === 'completed' || t.status === 'skipped');
  }
}

// ─── SDD Engine ─────────────────────────────────────────────────────────────
// Orchestrates the full SDD lifecycle.

export interface SddEngineConfig {
  db: SddDatabase;
  eventHandler?: HarnessEventHandler;
  /** Called to run an agent turn (returns the text response) */
  runAgentTurn: (systemPromptAddon: string, userMessage: string) => Promise<string>;
}

export class SddEngine {
  private planManager: PlanManager;
  private config: SddEngineConfig;
  private _paused = false;

  constructor(config: SddEngineConfig) {
    this.config = config;
    this.planManager = new PlanManager(config.db);
  }

  get paused(): boolean {
    return this._paused;
  }

  pause(): void {
    this._paused = true;
  }

  resume(): void {
    this._paused = false;
  }

  // ─── Phase 1: Describe ──────────────────────────────────────────────

  async startSession(projectId: string, description: string): Promise<SddSession> {
    const session = await this.planManager.createSession(projectId, description);
    this.emitPhaseChange('describing');
    return session;
  }

  // ─── Phase 2: Spec ──────────────────────────────────────────────────

  async generateSpec(sessionId: string): Promise<string> {
    const session = await this.planManager.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    this.emitPhaseChange('specifying');

    const prompt = `Generate a detailed specification document for the following feature request.

## Feature Description
${session.description}

## Required Output Format
Write a Markdown specification document with these sections:
1. **Purpose**: What this feature does and why it's needed
2. **Acceptance Criteria**: Concrete, testable criteria for completion
3. **Affected Files**: List of files that will be created or modified
4. **Technical Approach**: How it should be implemented
5. **Edge Cases**: Potential issues and how to handle them
6. **Out of Scope**: What is explicitly NOT part of this feature

Be specific and actionable. This spec will be used to generate an implementation plan.`;

    const spec = await this.config.runAgentTurn(
      'You are generating a specification document for a software feature. Be thorough and precise.',
      prompt,
    );

    await this.planManager.updateSpec(sessionId, spec);
    return spec;
  }

  async approveSpec(sessionId: string): Promise<void> {
    await this.planManager.approveSpec(sessionId);
  }

  // ─── Phase 3: Plan ──────────────────────────────────────────────────

  async generatePlan(sessionId: string): Promise<SddTask[]> {
    const session = await this.planManager.getSession(sessionId);
    if (!session || !session.spec) throw new Error('Session has no approved spec');

    this.emitPhaseChange('planning');

    const prompt = `Based on the following specification, create a step-by-step implementation plan.

## Specification
${session.spec}

## Required Output Format
Return a JSON array of tasks. Each task has:
- "title": Short task title (imperative, e.g., "Create user model")
- "description": What to do in this task (2-3 sentences)
- "files": Array of file paths that will be affected
- "dependencies": Array of task indices (0-based) this task depends on

Return ONLY the JSON array, no other text.
Order tasks so dependencies come first.`;

    const planResponse = await this.config.runAgentTurn(
      'You are a project planner. Generate a precise, ordered task list as JSON.',
      prompt,
    );

    // Parse the JSON response
    let rawTasks: Array<{ title: string; description: string; files: string[]; dependencies: number[] }>;
    try {
      // Extract JSON from response (might have markdown code fences)
      const jsonMatch = planResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found');
      rawTasks = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('Failed to parse plan. Agent response was not valid JSON.');
    }

    // Convert index-based dependencies to ID-based
    const tasks = await this.planManager.setTasks(
      sessionId,
      rawTasks.map((t) => ({
        title: t.title,
        description: t.description,
        files: t.files || [],
        dependencies: [], // Will be resolved after IDs are assigned
      })),
    );

    // Resolve dependencies
    for (let i = 0; i < rawTasks.length; i++) {
      const deps = (rawTasks[i].dependencies || [])
        .filter((idx) => idx >= 0 && idx < tasks.length)
        .map((idx) => tasks[idx].id);

      if (deps.length > 0) {
        await this.planManager.updateTaskStatus(tasks[i].id, 'pending');
        tasks[i].dependencies = deps;
      }
    }

    return tasks;
  }

  async approvePlan(sessionId: string): Promise<void> {
    await this.planManager.approvePlan(sessionId);
  }

  // ─── Phase 4: Execute ───────────────────────────────────────────────

  async execute(sessionId: string): Promise<void> {
    this.emitPhaseChange('executing');
    this._paused = false;

    while (!this._paused) {
      const task = await this.planManager.getNextTask(sessionId);
      if (!task) {
        // All tasks done
        break;
      }

      this.config.eventHandler?.({ type: 'sdd_task_start', task });
      await this.planManager.updateTaskStatus(task.id, 'in_progress');

      try {
        const taskPrompt = `Execute the following task from the implementation plan:

## Task: ${task.title}
${task.description}

## Files to modify
${task.files.join('\n') || 'Not specified'}

Complete this task by using the available tools. Read files before modifying them.
When done, provide a brief summary of what you did.`;

        const output = await this.config.runAgentTurn(
          'You are executing a specific task from an implementation plan. Stay focused on this task only.',
          taskPrompt,
        );

        await this.planManager.updateTaskStatus(task.id, 'completed', output);

        const updatedTask = { ...task, status: 'completed' as SddTaskStatus, agentOutput: output };
        this.config.eventHandler?.({ type: 'sdd_task_complete', task: updatedTask });
      } catch (err) {
        await this.planManager.updateTaskStatus(
          task.id,
          'failed',
          err instanceof Error ? err.message : String(err),
        );
        break;
      }
    }

    // Check completion
    const isComplete = await this.planManager.isComplete(sessionId);
    if (isComplete) {
      await this.review(sessionId);
    }
  }

  /** Skip a specific task */
  async skipTask(taskId: string): Promise<void> {
    await this.planManager.updateTaskStatus(taskId, 'skipped');
  }

  // ─── Phase 5: Review ───────────────────────────────────────────────

  async review(sessionId: string): Promise<string> {
    const session = await this.planManager.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    this.emitPhaseChange('reviewing');

    const taskSummaries = session.tasks
      .map((t) => `- [${t.status}] ${t.title}: ${t.agentOutput || 'No output'}`)
      .join('\n');

    const prompt = `Review the implementation of the following feature.

## Original Description
${session.description}

## Specification
${session.spec}

## Task Results
${taskSummaries}

## Review Checklist
1. Do the changes match the specification?
2. Are there any missing pieces?
3. Are there potential bugs or issues?
4. Does the code follow project conventions?

Provide a summary of the implementation and any issues found.`;

    const reviewOutput = await this.config.runAgentTurn(
      'You are reviewing a completed implementation. Be thorough but fair.',
      prompt,
    );

    await this.planManager.completeSession(sessionId);
    this.emitPhaseChange('completed');

    return reviewOutput;
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private emitPhaseChange(phase: SddStatus): void {
    this.config.eventHandler?.({ type: 'sdd_phase_change', phase });
  }
}
