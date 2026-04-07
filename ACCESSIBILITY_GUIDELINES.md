# Accessibility Guidelines for Linear Mode Extensions

## Overview

These guidelines ensure that pi-linear-mode extensions are screen-reader friendly and provide a clean, accessible user experience. All extensions should follow these principles.

## Core Principles

### 1. **Use Brackets `[` and `]` for UI/System Lines**
- **Purpose**: Differentiate UI/system messages from LLM/tool output
- **Format**: `[Message content here]`
- **Examples**:
  - `[$ ls -la] Running...`
  - `[read: package.json] Result: 25 lines`
  - `[Error: File not found]`
  - `[Working...]`
  - `[Interaction: Choose an option]`

### 2. **Minimize Blank Lines**
- Only use spacers (`Spacer(1)`) for major section transitions
- Avoid blank lines between related items
- Combine related information on single lines when possible

### 3. **Maximize Useful Information Per Line**
- Combine command and status on same line: `[$ command] Status`
- Put descriptions on same line as items when short: `[1] Label - Description`
- Truncate long lines for screen readers (80 chars max)

### 4. **Provide Clear User Feedback**
- Show `[Working...]` during LLM processing
- Show `[Running...]` during command execution
- Show completion status: `[Done]`, `[Error: ...]`, `[Exit 1]`
- Include line counts: `(25 lines)`

## Implementation Guidelines

### Formatting Functions
Use the formatting utilities in `src/lib/formatting.ts`:

```typescript
import { 
  formatUIMessage, 
  formatCommand, 
  formatStatus,
  formatToolCall,
  formatToolResult,
  formatSelectorItem,
  formatCustomMessage,
  truncateForScreenReader 
} from "../lib/formatting.ts";
```

### Tool Renderers
- **Tool calls**: Use `formatToolCall("read", args)` → `[read: file.txt]`
- **Tool results**: Use `formatToolResult("25 lines")` → `[Result: 25 lines]`
- **Partial results**: Show `[reading...]`, `[running...]`, etc.
- **Output preview**: Show 5-8 lines max, truncate long lines

### Bash Renderer
- **Command line**: `formatCommand(command, excludeFromContext)` → `[$ ls -la]` or `[# secret]`
- **Status**: Combine with command: `[$ ls -la] Running...`
- **Output**: Show last 5 lines, truncate long lines

### Selector Renderer
- **Items**: `formatSelectorItem(i, label, isSelected)` → `>[1] Label` or ` [2] Label`
- **Descriptions**: On same line if short: `[1] Label - Description`
- **Instructions**: `[Enter number (1-5) or press Esc to cancel]`

### Message Renderers
- **Custom messages**: `formatCustomMessage(type, content)` → `[Interaction: Choose option]`
- **Status messages**: `[Status: ...]`
- **Error messages**: `[Error: ...]`

### Notifications
- **All notifications**: Wrap in brackets: `ctx.ui.notify("[Message]", "info")`
- **Errors**: `ctx.ui.notify("[Error: details]", "error")`
- **Warnings**: `ctx.ui.notify("[Warning: details]", "warning")`

### Working Messages
- **During LLM processing**: Show `[Working...]`
- **Clear when done**: On `tool_call` or `assistant_message` events
- **Safety timeout**: Clear after 2 minutes if not cleared

## Examples

### Before (Not Accessible)
```
$ ls -la

Running...

file1.txt
file2.txt
directory/

Done
```

### After (Accessible)
```
[$ ls -la] Running...
file1.txt
file2.txt
directory/
[$ ls -la] Done (4 items)
```

### Before (Not Accessible)
```
read package.json
25 lines
{
  "name": "project",
  "version": "1.0.0"
}
```

### After (Accessible)
```
[read: package.json] [Result: 25 lines]
{
  "name": "project",
  "version": "1.0.0"
}
```

## Testing

1. **Screen Reader Testing**: Use with NVDA, VoiceOver, or Orca
2. **Visual Testing**: Ensure brackets are visible but not distracting
3. **Functionality Testing**: All features still work correctly
4. **Performance Testing**: No unnecessary re-renders or delays

## Common Issues to Avoid

1. **Missing brackets** on UI/system messages
2. **Excessive blank lines** between related items
3. **Overly long lines** that screen readers struggle with
4. **Missing status feedback** during operations
5. **Inconsistent formatting** across extensions

## Updates Required

When adding new extensions or modifying existing ones:

1. Import formatting utilities
2. Use bracket formatting for all UI/system messages
3. Minimize blank lines
4. Combine related information
5. Test with screen readers

By following these guidelines, we ensure pi-linear-mode provides an excellent experience for all users, including those using screen readers.