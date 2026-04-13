# Tools Specification

## Overview

Tools are the mechanisms through which the AI agent interacts with the real development environment. Each tool has a formal definition (name, description, input schema, output format) used by the LLM for function calling.

---

## Tool Definition Format

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, JSONSchemaProperty>;
    required: string[];
  };
  category: ToolCategory;
  requiresApproval: boolean;
}

type ToolCategory = 'filesystem' | 'terminal' | 'git' | 'code' | 'browser' | 'mcp' | 'meta';
```

---

## Built-in Tools

### 1. read_file

**Category**: filesystem | **Approval**: no

```json
{
  "name": "read_file",
  "description": "Read the contents of a file. You can specify a line range to read only part of the file. Line numbers are 1-indexed.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Absolute or workspace-relative path to the file"
      },
      "start_line": {
        "type": "integer",
        "description": "Starting line number (1-indexed, inclusive). Omit to read from beginning."
      },
      "end_line": {
        "type": "integer",
        "description": "Ending line number (1-indexed, inclusive). Omit to read to end."
      }
    },
    "required": ["path"]
  }
}
```

**Output**: File content as string, with line numbers prepended. Returns error if file doesn't exist.

---

### 2. write_file

**Category**: filesystem | **Approval**: yes

```json
{
  "name": "write_file",
  "description": "Write content to a file. If the file exists, it will be overwritten. If parent directories don't exist, they will be created.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Absolute or workspace-relative path to the file"
      },
      "content": {
        "type": "string",
        "description": "The full content to write to the file"
      }
    },
    "required": ["path", "content"]
  }
}
```

---

### 3. edit_file

**Category**: filesystem | **Approval**: yes

```json
{
  "name": "edit_file",
  "description": "Make a targeted edit to a file by replacing an exact string with a new string. The old_string must match exactly (including whitespace and indentation). Include enough context lines to uniquely identify the location.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Absolute or workspace-relative path to the file"
      },
      "old_string": {
        "type": "string",
        "description": "The exact text to find and replace. Must match exactly one location in the file."
      },
      "new_string": {
        "type": "string",
        "description": "The text to replace old_string with"
      }
    },
    "required": ["path", "old_string", "new_string"]
  }
}
```

**Output**: Success message with line range affected. Error if old_string not found or matches multiple locations.

---

### 4. create_file

**Category**: filesystem | **Approval**: yes

```json
{
  "name": "create_file",
  "description": "Create a new file with the specified content. Fails if the file already exists. Parent directories are created automatically.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Absolute or workspace-relative path for the new file"
      },
      "content": {
        "type": "string",
        "description": "The content for the new file"
      }
    },
    "required": ["path", "content"]
  }
}
```

---

### 5. list_directory

**Category**: filesystem | **Approval**: no

```json
{
  "name": "list_directory",
  "description": "List the contents of a directory. Returns file and folder names. Folders end with /.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Absolute or workspace-relative path to the directory"
      },
      "recursive": {
        "type": "boolean",
        "description": "If true, list all files recursively (default: false)"
      },
      "max_depth": {
        "type": "integer",
        "description": "Maximum depth for recursive listing (default: 3)"
      }
    },
    "required": ["path"]
  }
}
```

---

### 6. search_code

**Category**: filesystem | **Approval**: no

```json
{
  "name": "search_code",
  "description": "Search for text or regex patterns across files in the workspace. Returns matching lines with file paths and line numbers.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "pattern": {
        "type": "string",
        "description": "Text or regex pattern to search for (case-insensitive)"
      },
      "include_pattern": {
        "type": "string",
        "description": "Glob pattern to filter files (e.g., '**/*.ts')"
      },
      "is_regex": {
        "type": "boolean",
        "description": "Whether pattern is a regex (default: false)"
      },
      "max_results": {
        "type": "integer",
        "description": "Maximum number of matches to return (default: 50)"
      }
    },
    "required": ["pattern"]
  }
}
```

---

### 7. run_terminal_command

**Category**: terminal | **Approval**: yes

```json
{
  "name": "run_terminal_command",
  "description": "Execute a command in the terminal. Returns stdout and stderr. Use for running tests, installing packages, running scripts, etc.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "command": {
        "type": "string",
        "description": "The command to execute"
      },
      "cwd": {
        "type": "string",
        "description": "Working directory (default: workspace root)"
      },
      "timeout_ms": {
        "type": "integer",
        "description": "Timeout in milliseconds (default: 30000)"
      }
    },
    "required": ["command"]
  }
}
```

**Output**: `{ stdout, stderr, exitCode, durationMs }`

---

### 8. git_status

**Category**: git | **Approval**: no

```json
{
  "name": "git_status",
  "description": "Get the current git status of the workspace. Shows modified, added, deleted, and untracked files.",
  "inputSchema": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

---

### 9. git_diff

**Category**: git | **Approval**: no

```json
{
  "name": "git_diff",
  "description": "Get the git diff of uncommitted changes.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "staged": {
        "type": "boolean",
        "description": "If true, show diff of staged changes only (default: false, shows all)"
      },
      "path": {
        "type": "string",
        "description": "Optional: diff only this file"
      }
    },
    "required": []
  }
}
```

---

### 10. git_commit

**Category**: git | **Approval**: yes

```json
{
  "name": "git_commit",
  "description": "Stage files and create a git commit with the specified message.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "message": {
        "type": "string",
        "description": "Commit message (follow conventional commits format)"
      },
      "paths": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Files to stage and commit. If empty, commits all staged changes."
      }
    },
    "required": ["message"]
  }
}
```

---

### 11. run_code

**Category**: code | **Approval**: yes

```json
{
  "name": "run_code",
  "description": "Execute a code snippet in a sandboxed environment. Supports JavaScript/TypeScript, Python, and shell scripts. Has no network access and limited CPU/memory.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "code": {
        "type": "string",
        "description": "The code to execute"
      },
      "language": {
        "type": "string",
        "enum": ["javascript", "typescript", "python", "bash"],
        "description": "Programming language of the code"
      },
      "timeout_ms": {
        "type": "integer",
        "description": "Execution timeout in milliseconds (default: 10000, max: 30000)"
      }
    },
    "required": ["code", "language"]
  }
}
```

---

### 12. web_search

**Category**: browser | **Approval**: no

```json
{
  "name": "web_search",
  "description": "Search the web for information. Returns a summary of top results. Use for looking up documentation, error solutions, or API references.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "The search query"
      },
      "max_results": {
        "type": "integer",
        "description": "Maximum number of results to return (default: 5)"
      }
    },
    "required": ["query"]
  }
}
```

---

### 13. mcp_call

**Category**: mcp | **Approval**: configurable

```json
{
  "name": "mcp_call",
  "description": "Call a tool provided by a connected MCP server. Use list_mcp_tools first to see available tools.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "server_id": {
        "type": "string",
        "description": "The MCP server ID"
      },
      "tool_name": {
        "type": "string",
        "description": "The tool name on that server"
      },
      "arguments": {
        "type": "object",
        "description": "Arguments to pass to the tool"
      }
    },
    "required": ["server_id", "tool_name"]
  }
}
```

---

### 14. activate_skill

**Category**: meta | **Approval**: no

```json
{
  "name": "activate_skill",
  "description": "Activate a skill to enhance your capabilities for the current conversation. Skills provide domain-specific instructions and best practices.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "skill_name": {
        "type": "string",
        "description": "Name of the skill to activate"
      }
    },
    "required": ["skill_name"]
  }
}
```

---

### 15. list_mcp_tools

**Category**: meta | **Approval**: no

```json
{
  "name": "list_mcp_tools",
  "description": "List all tools available from connected MCP servers.",
  "inputSchema": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

---

## Tool Execution Pipeline

```
Agent returns tool_call
  → Validate input against schema
  → Check approval requirement
  → If needs approval: enqueue in pendingToolCalls, wait for user
  → If auto-approved: proceed
  → Route to handler (Tauri command or MCP call)
  → Capture output and timing
  → Log to telemetry (provider, tool, duration)
  → Return ToolResult to agent
  → Agent continues with next step
```

---

## Error Handling

| Error | Behavior |
|---|---|
| Invalid input (schema validation) | Return validation error to agent, agent retries |
| File not found | Return error message, agent should try different path |
| Permission denied | Return error, suggest correct approach |
| Timeout | Kill execution, return timeout error |
| Agent rejected tool call | Return rejection with user's reason |
| Tool handler exception | Return generic error, log details |
