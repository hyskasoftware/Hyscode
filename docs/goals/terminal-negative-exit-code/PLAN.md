# PowerShell Terminal Exit-Code Integrity Plan

**Intent:** Correct the PowerShell framed-command wrapper so native stderr follows the user's command routing and the command's real exit code reaches the Harness without an artificial `-1`.

**Current Behavior:** `packages/agent-harness/src/terminal-protocol.ts` executes decoded PowerShell commands inside a scriptblock with `$ErrorActionPreference = 'Stop'`. When a user command redirects native stderr into a PowerShell pipeline, for example `2>&1 | Out-File`, Windows PowerShell materializes the native stderr record as a `RemoteException`. The wrapper enters `catch` before its post-command status calculation and observes `$LASTEXITCODE = -1`. The `finally` marker therefore carries `-1`, and `TerminalCommandRunner` faithfully returns `Error: Exit code: -1`.

**Expected Outcome:** A framed PowerShell command completes exactly once, preserves stdout/stderr according to the command's explicit redirections, and reports the command's actual exit status. A failing npm/Vitest-style command that writes diagnostics to stderr and exits with `1` must return `exitCode: 1`, not `-1`. PowerShell cmdlet and parse errors must still return a nonzero result and still emit the completion marker. A genuinely emitted native negative code remains unchanged; the implementation must not apply a blanket `-1 -> 1` conversion.

**Target-Perspective Output:** The user runs `npm test --silent 2>&1 | Out-File ...; Write-Output "RC=$LASTEXITCODE"; Get-Content ...` in the TUI or Desktop terminal. Because the command explicitly reads the file, the test log and failure diagnostics remain visible, the terminal tool finishes promptly, and the tool result says `Exit code: 1` when the test process returned `1`. A direct native command that writes informational stderr and exits `0` remains successful.

**Truth Owner:** The wrapped shell owns the command exit status. The PTY runtime owns the persistent shell process lifecycle and raw output ordering. `CommandWatch` owns frame completion parsing but must not invent or normalize an exit code. `TerminalCommandRunner` owns the canonical `ToolResult`; TUI/Desktop projections only display it.

**Contract Boundary:**

- `buildTerminalFrame(command, 'powershell', nonce)` emits a failure-safe PowerShell frame.
- The frame's END marker carries the wrapped command's native exit status when one exists; PowerShell errors without a native status map to `1`; success maps to `0`.
- Native stderr is output, not an implicit Harness failure. The command's exit status determines `ToolResult.success`.
- `parseTerminalFrame` accepts the signed integer in the marker and preserves genuine negative values.
- The wrapper must keep native stderr streaming when the command leaves it attached to the PTY. If the user redirects stderr to a file, the command owns that visibility; tests must assert the file/read-back path rather than require the wrapper to duplicate redirected bytes.

## PowerShell status-capture algorithm

The implementation should keep the frame in an outer local scriptblock, execute the user command in a child scope, and transfer only scalar status values plus the captured error-record array back to the outer scope:

1. Snapshot the per-invocation `$Error` baseline; never classify the entire persistent shell error list.
2. Generate nonce-scoped variable names for native status, invocation observability, captured errors, and the error baseline so ordinary command variables cannot collide with frame state.
3. Set `$ErrorActionPreference = 'Continue'` only inside the command scope.
4. Set `$PSNativeCommandUseErrorActionPreference = $false` in that same scope so PowerShell 7 does not promote native nonzero status to an additional wrapper error.
5. Run `Invoke-Expression -Command $hysCommand -ErrorAction Continue -ErrorVariable <nonce-scoped-name>` without buffering or re-emitting the command stream.
6. Capture `$?` into a scalar as the first expression after `Invoke-Expression`, then capture `[int]$LASTEXITCODE` and the local error records. Use a module-qualified `Set-Variable -Scope 1` to transfer them to the outer frame scope before any status assignment can be shadowed.
7. Classify records whose `FullyQualifiedErrorId` starts with `NativeCommandError` as native stderr and exclude them from PowerShell-error failure detection. Treat remaining new/captured PowerShell records, or a caught terminating exception, as errors. Compute the marker code with this precedence: nonzero native code (including a genuine negative code) > non-native PowerShell error (`1`) > success (`0`). A false `$?` alone must never fail a command; when only native-error records or redirected native output are present and the native code is `0`, the marker remains `0`.
8. Catch terminating parse/runtime errors, use `1` when no nonzero native code is available, write the error with `-ErrorAction Continue`, and always emit the existing END marker from `finally`.

For the exact `Out-File` shape, the user's redirection owns the output destination. The wrapper must not replay those bytes into the PTY; the test reads the file back, or uses `Tee-Object` when live duplication is intentionally requested. Direct stderr remains visible through the PTY.

**Cutover:** Replace the current PowerShell `ErrorActionPreference = 'Stop'` invocation path with the outer-local/child-command scope algorithm above. Capture invocation success before any assignment can overwrite `$?`, transfer native status and local error records to the outer scope, then compute one `$hysCode` using nonzero native status > PowerShell error > success. Keep the existing Base64 command transport, marker protocol, newline separators, POSIX wrapper, and runner/parser result shape.

**Displaced Path:** The current catch-driven status path that reads `$LASTEXITCODE` after a stderr-induced `RemoteException` is removed. No second PowerShell wrapper, alternate parser, automatic replay of user-redirected stderr, or `-1` post-processing shim may remain. The PTY adapters are not displaced; they remain the lifecycle authorities.

**Value Density:** One shared wrapper change covers the TUI and Desktop because both use `buildTerminalFrame`. It fixes native test/build/package commands that emit stderr, retains PowerShell error detection, and avoids changing every tool or runtime adapter independently.

**Acceptance Evidence:**

1. A real Windows PowerShell integration test runs a temporary npm-style failing command with the exact `2>&1 | Out-File ...; Write-Output "RC=$LASTEXITCODE"; Get-Content ...` shape; the parsed frame is complete, the read-back output contains the diagnostics and `RC=1`, and the parsed code is `1`.
2. Real Windows PowerShell tests run native commands that write stderr directly and exit `1` or `0`, plus the exact `2>&1 | Out-File` shape with native exit `0`; native stderr records remain output, the redirected file is verified by read-back, and the parsed codes are respectively `1`, `0`, and `0`.
3. Real Windows PowerShell tests exercise a PowerShell cmdlet error, a PowerShell parse error, and a mixed `PowerShell error; successful native command` sequence; each emits the END marker and the first two/mixed cases report nonzero instead of being hidden by the later native `0`. The test records `$?` before status-object assignments but verifies that `$?` alone is not a failure predicate.
4. A real Windows producer-level test runs `cmd /c exit /b -1` through the frame and proves a genuine negative native status remains `-1`; no blanket negative-code normalization is introduced.
5. Focused runner and Harness tests prove the canonical `ToolResult` metadata, error text, and model-facing output use the corrected code and preserve stdout/stderr without a second normalization layer.
6. A TUI/CLI smoke run observes one completed tool result with `Exit code: 1`; Desktop terminal adapter coverage proves code-or-null PTY snapshot/event values are forwarded unchanged, while the agent-harness runner/Harness tests prove the canonical `ToolResult`.
7. A `CliHost` PTY lifecycle regression covers a short-lived process exit without a frame, verifies the reported numeric process code/`null` behavior, and keeps that code-only contract distinct from framed command status. This plan makes no signal-preservation claim.
8. Existing POSIX framing, interactive response, background readiness, cancellation, process-exit, and output-truncation tests remain green; `npm run lint`, `npm run typecheck`, focused package tests, and the full workspace test command pass.

**Evidence Lane:** Windows PowerShell 5.1 process integration first, then `pwsh.exe` when available, then Harness runner fakes, Desktop adapter coverage, and actual `CliHost`/TUI PTY smoke. Tests must distinguish direct stderr from user-directed file output and assert raw observable output plus parsed result, not only wrapper source text. The manual target-perspective smoke claim is limited to TUI/CLI unless a live Tauri Desktop run is available; Desktop's shared-contract evidence comes from its adapter tests.

**Kill Criteria:** Stop and revise the plan if any proposed fix does one of the following: coerces every `-1` to `1`; treats any stderr byte as command failure; buffers the entire command output instead of streaming it; re-emits bytes the user's command redirected to a file; mutates the persistent user's `$ErrorActionPreference`; hides PowerShell cmdlet failures; removes the completion marker on PowerShell errors; changes PTY process exit or signal semantics without a separate contract; adds a second command-execution path; or makes the TUI/Desktop infer success independently of the Harness result.

**Non-goals:**

- No change to npm, Vitest, Node, or user project exit behavior.
- No blanket remapping of negative native exit codes.
- No change to POSIX framing.
- No redesign of `CommandWatch`, PTY sequence replay, terminal ownership, or timeout policy unless a regression test proves the wrapper fix cannot satisfy the contract.
- No signal field/protocol expansion in this plan; the existing PTY contract remains code-or-null, and any signal-preservation requirement gets a separate plan.
- No change to Desktop/TUI visual rendering; those surfaces should consume the corrected canonical result.
- No commit, push, issue, or PR in the planning phase.

**Risk if wrong:** A too-broad `Continue` change could hide PowerShell cmdlet failures or allow a command with a PowerShell error followed by successful output to appear successful. Treating redirected native stderr as a wrapper error produces the observed `-1`; treating all false `$?` values as failure would incorrectly fail native stderr with exit `0`, while ignoring non-native error records would hide real PowerShell failures. Automatically replaying redirected bytes would duplicate user output. A negative-code coercion would hide real process behavior. The acceptance matrix must cover direct native stderr, redirected stderr, `NativeCommandError` classification, PowerShell errors, mixed error/status order, genuine negative native status, and the separate PTY process-exit path.

**Architecture Slice:**

- **Files to modify:**
  - `packages/agent-harness/src/terminal-protocol.ts` — PowerShell frame status capture.
  - `packages/agent-harness/src/terminal-protocol.test.ts` — real PowerShell and parser contract tests.
  - `packages/agent-harness/src/terminal-command-runner.test.ts` — canonical result and negative-code preservation tests.
  - `packages/agent-harness/src/harness.test.ts` — Harness forwarding regression for corrected native failure output.
  - `packages/tui-runtime/src/host.test.ts` — PTY process-exit contract regression, without changing the host authority.
  - `apps/desktop/src/lib/terminal-runtime.test.ts` — Desktop adapter forwarding regression, without changing the adapter authority.
- **Files to inspect but avoid changing unless evidence requires it:**
  - `packages/agent-harness/src/command-watch.ts` — parser consumer; no expected source change.
  - `packages/tui-runtime/src/host.ts` and `packages/tui-runtime/src/pty.ts` — PTY lifecycle authorities; test raw process-exit behavior separately.
  - `packages/tui-runtime/src/bridge.ts` — adapter projection; no expected source change.
  - `apps/desktop/src/lib/terminal-runtime.ts` and `apps/desktop/src-tauri/src/commands/pty.rs` — Desktop PTY path; both consume the shared frame contract.
  - `tools/hyscode-tui/src/controller.ts` and `tools/hyscode-tui/src/renderer.ts` — UI projections; no local `-1` rewrite is allowed.
- **Source of truth:** The PowerShell wrapper's captured status for foreground commands; PTY runtime status only for shell/process exit without a frame.
- **Read path:** PTY data/snapshot → `CommandWatch` → `parseTerminalFrame` → `TerminalCommandRunner` → `ToolResult` → Harness transcript/event → TUI/Desktop projection.
- **Write path:** Tool input → `buildTerminalFrame` → persistent shell stdin → command execution → END marker.
- **Integration points:** `TerminalCommandRunner.run`, `TerminalCommandRunner.respond`, `CommandWatch.evaluate`, `TerminalRuntimeAdapter.subscribe/snapshot`, `Harness` tool result emission, and TUI/desktop terminal progress.
- **Migration/cutover:** Keep the existing marker format and parser API; replace only the PowerShell status-capture internals and update tests/docs to codify the corrected stream semantics.
- **Displaced path:** EAP-Stop-driven catch status capture.
- **Acceptance evidence gate:** Do not consider the plan implemented until the real Windows stderr-redirection test reports `1`, the PowerShell-error test still reports nonzero, and the TUI/CLI smoke path returns one canonical result.

## Root-cause evidence already collected

The following experiments establish the failure before implementation:

- Direct PowerShell pipeline with a native command returning `1` reports `RC=1`.
- The same command inside the current wrapper with `$ErrorActionPreference = 'Stop'` enters `catch` with `CATCH_LAST=-1` and `System.Management.Automation.RemoteException`.
- The current real frame parsed the stderr-redirection command as `complete: true, exitCode: -1`.
- The same current frame reports `exitCode: 1` when the native command fails without emitting stderr.
- A controlled npm-style temporary package that writes a failure to stderr and exits `1` reproduced the same framed `-1`.
- `CommandWatch` accepts signed integers by design; it is exposing the wrapper's value rather than generating it.

The reported machine runs Windows PowerShell `5.1.26100.9168`; `pwsh.exe` 7 is also installed. A direct failing native pipeline returns `RC=1`, while the current framed wrapper returns `exitCode: -1` only when native stderr is redirected through `2>&1 | Out-File` under `ErrorActionPreference = 'Stop'`. The same current frame returns `1` for a clean native failure and returns `1` under `pwsh.exe`, which localizes the regression to Windows PowerShell 5.1 error-stream handling.

## Review corrections incorporated

The PRE review requires five explicit distinctions in execution: `Out-File` is an intentional user redirection and must be asserted through read-back (or replaced by `Tee-Object` for a live-output test); WinPS 5.1 `NativeCommandError` records are output and must not be counted as PowerShell failures; `$?` must be captured before any assignment but never used alone as a failure predicate; a non-native error must still beat a later native `0`; and a producer-level test, not only a synthetic parser fixture, must establish genuine negative-code preservation. The PTY signal field remains outside this plan's code-or-null contract.

Microsoft's PowerShell preference-variable documentation confirms that `$ErrorActionPreference = 'Stop'` escalates non-terminating errors and that native-command error handling is a scoped preference: <https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_preference_variables?view=powershell-7.5>.

## Execution tasks

1. **Replace PowerShell status capture** — modify `terminal-protocol.ts`; preserve Base64 transport, marker delimiters, stream order, and failure-safe `finally`; implement the outer local scope, child command scope, nonce-scoped scalar handoff, first-expression `$?` capture for observability, native-error classification, and precedence above. No parser or PTY source changes in this task.
2. **Add the protocol acceptance matrix** — extend `terminal-protocol.test.ts` with the exact npm-style `Out-File`/read-back case, direct and redirected native stderr exit `1`/`0`, explicit `NativeCommandError` classification, PowerShell cmdlet/parse errors, mixed error/native-success ordering, both supported Windows shell executables when available, and a producer-level genuine negative-code test.
3. **Verify runner and Harness contract** — extend `terminal-command-runner.test.ts` and `harness.test.ts` so canonical `ToolResult` success/error, metadata, output, and model-facing formatting reflect the corrected code without a second normalization layer.
4. **Verify PTY boundary semantics** — extend `packages/tui-runtime/src/host.test.ts` and `apps/desktop/src/lib/terminal-runtime.test.ts` only as needed to prove process exit data remains separate from framed command status; these tests do not construct `ToolResult` and do not add signal semantics without a separate contract.
5. **Clarify the ADR contract** — update ADR 0004 only after tests establish the behavior; document that stdout/stderr are combined PTY output while the wrapper's exit marker is the status authority and redirected output remains owned by the command.
6. **Run target-perspective smoke evidence** — exercise the actual TUI/CLI PTY path with a failing npm-style command and confirm one completed result, preserved read-back diagnostics, and `Exit code: 1`; record Desktop evidence at the adapter/live-runtime level actually exercised.
7. **Run final gates** — focused tests, TUI package tests, agent-harness tests, TUI runtime tests, full workspace tests, lint, and typecheck; record unrelated existing warnings separately.

Tasks 1 and 2 share the same protocol boundary and should be executed sequentially. Task 3 depends on task 1. Task 4 depends on the accepted contract. Task 5 depends on tasks 1–3. Task 6 is the final integration gate.

**Plan Review Gate:** Requires PRE review before execution.
