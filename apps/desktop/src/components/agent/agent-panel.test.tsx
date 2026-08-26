/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentPanel } from './agent-panel';
import { useAgentStore } from '@/stores/agent-store';

vi.mock('./agent-messages', () => ({ AgentMessages: () => null }));
vi.mock('./agent-input', () => ({ AgentInput: () => null }));
vi.mock('./context-chips-bar', () => ({ ContextChipsBar: () => null }));
vi.mock('./session-history', () => ({ SessionHistory: () => null }));
vi.mock('./sdd/sdd-stepper', () => ({ SddStepper: () => null }));
vi.mock('./sdd/sdd-spec-review', () => ({ SddSpecReview: () => null }));
vi.mock('./sdd/sdd-task-list', () => ({ SddTaskList: () => null }));
vi.mock('./agent-task-list', () => ({ AgentTaskList: () => null }));
vi.mock('./agent-question-card', () => ({ AgentQuestionCard: () => null }));
vi.mock('./rules-panel-dialog', () => ({ RulesPanelDialog: () => null }));
vi.mock('./agent-task-context-card', () => ({ AgentTaskContextCard: () => null }));
vi.mock('@/components/terminal', () => ({ TerminalPanel: () => null }));
vi.mock('@/lib/active-agent-bridge', () => ({
  getActiveAgentBridge: () => {
    throw new Error('bridge not ready');
  },
}));
vi.mock('@hyscode/ai-providers', () => ({
  getProviderRegistry: () => ({ get: () => undefined }),
}));

function seedTabs(openTabs: Array<{ id: string; title: string }>, activeTabId: string) {
  useAgentStore.setState({ openTabs, activeTabId, isStreaming: false });
}

function getTab(title: string) {
  return screen.getByText(title).closest('div')!;
}

describe('AgentPanel tab bar', () => {
  afterEach(() => {
    cleanup();
    useAgentStore.setState({
      openTabs: [{ id: '__default__', title: 'New Chat' }],
      activeTabId: '__default__',
      isStreaming: false,
    });
  });

  beforeEach(() => {
    seedTabs(
      [
        { id: 'tab-a', title: 'Chat A' },
        { id: 'tab-b', title: 'Chat B' },
      ],
      'tab-a',
    );
  });

  it('closes a background tab on middle click', () => {
    render(<AgentPanel />);

    fireEvent.mouseDown(getTab('Chat B'), { button: 1 });

    const state = useAgentStore.getState();
    expect(state.openTabs.map((t) => t.id)).toEqual(['tab-a']);
    expect(state.activeTabId).toBe('tab-a');
  });

  it('still switches tabs with a left click', () => {
    render(<AgentPanel />);

    fireEvent.click(getTab('Chat B'));

    expect(useAgentStore.getState().activeTabId).toBe('tab-b');
  });

  it('refuses to close the active streaming tab on middle click', () => {
    useAgentStore.setState({ isStreaming: true });
    render(<AgentPanel />);

    fireEvent.mouseDown(getTab('Chat A'), { button: 1 });

    const state = useAgentStore.getState();
    expect(state.openTabs).toHaveLength(2);
  });
});
