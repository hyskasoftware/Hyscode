# Goal: PowerShell Terminal Exit-Code Integrity

## Goal package

- Plan: `docs/goals/terminal-negative-exit-code/PLAN.md`
- Scope: Shared Harness PowerShell framing, terminal contract tests, Harness forwarding tests, PTY code-only boundary checks, Desktop adapter coverage, and ADR clarification
- Status: Implemented and verified; full workspace gates pass; live Tauri process and PTY signal semantics remain outside this goal

## Intent

Use Krypton Execution to execute `docs/goals/terminal-negative-exit-code/PLAN.md`. Correct the shared PowerShell frame so a native command that writes stderr and exits `1` reaches the Harness as `exitCode: 1` instead of the wrapper-induced `-1`, without hiding PowerShell errors or changing genuine negative native statuses.

## Expected outcome

The TUI and Desktop terminal paths retain the existing PTY and framed-command architecture. Native stderr remains visible when attached to the PTY; explicit `Out-File` redirection remains owned by the user command and is verified through read-back. The END marker is emitted once with the actual command status. The Harness returns one canonical result, and a failing npm/Vitest-style command is displayed as `Exit code: 1` rather than timing out or reporting an artificial `-1`.

## Truth owner

The PowerShell wrapper owns the foreground command status; the PTY runtime owns persistent shell lifecycle; `CommandWatch` parses but does not normalize; `TerminalCommandRunner` owns the canonical result; UI clients are projections.

## Required evidence

- Real Windows PowerShell 5.1 tests for direct and redirected native stderr with exit `1`, native stderr with exit `0`, PowerShell cmdlet/parse errors, mixed error/native-success ordering, and genuine negative exit preservation.
- Runner and Harness tests proving output, metadata, and model-facing error text.
- Actual TUI/CLI PTY smoke evidence showing one completed result with `Exit code: 1`; Desktop adapter evidence must show the shared result is forwarded unchanged.
- PTY lifecycle coverage keeps process code-or-null semantics separate from framed command status; this goal does not expand signal propagation.
- Focused and full workspace tests, lint, and typecheck.

Do not add a second wrapper or a blanket `-1 -> 1` conversion. Preserve the cutover and kill criteria in `PLAN.md`.
