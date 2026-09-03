import { describe, expect, it } from 'vitest';
import {
  OPENCODE_SESSION_HEADER,
  opencodeRequestHeaders,
  withOpencodeHeaders,
} from './opencode-headers';

describe('opencode-headers', () => {
  it('builds a session header plus an identifiable User-Agent', () => {
    const headers = opencodeRequestHeaders('conv-123');
    expect(headers[OPENCODE_SESSION_HEADER]).toBe('conv-123');
    expect(headers['User-Agent']).toMatch(/^(HysCode|Vortex)$/);
  });

  it('omits the session header when no session id is given', () => {
    const headers = opencodeRequestHeaders();
    expect(headers[OPENCODE_SESSION_HEADER]).toBeUndefined();
    expect(headers['User-Agent']).toMatch(/^(HysCode|Vortex)$/);
  });

  it('injects headers only for opencode.ai URLs', () => {
    const base = { 'Content-Type': 'application/json' };
    const injected = withOpencodeHeaders(base, 'https://opencode.ai/zen/v1/responses', 's1');
    expect(injected[OPENCODE_SESSION_HEADER]).toBe('s1');
    expect(injected['User-Agent']).toBeDefined();

    const untouched = withOpencodeHeaders(base, 'https://api.openai.com/v1/responses', 's1');
    expect(untouched).toEqual(base);
  });

  it('never overwrites a caller-provided User-Agent', () => {
    const injected = withOpencodeHeaders(
      { 'User-Agent': 'CustomTool/2.0' },
      'https://opencode.ai/zen/go/v1/chat/completions',
      's2',
    );
    expect(injected['User-Agent']).toBe('CustomTool/2.0');
    expect(injected[OPENCODE_SESSION_HEADER]).toBe('s2');
  });
});
