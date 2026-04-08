# pi-linear-mode-extension

A pi extension that provides a more linear workflow inside the pi CLI with numbered interactions and custom renderers.

## Features

- **Numbered Interactions**: Tools are displayed with numbers for easy selection
- **Custom Tool Renderers**: Linear display of tool calls and results
- **Selector Renderer**: Interactive selection UI for choosing options
- **Message Renderers**: Custom display for different message types
- **Screen Reader Accessibility**: All UI elements marked with `[` and `]` brackets
- **Footer Suppression**: Option to suppress frequently updating footer for screen readers
- **Working Message**: Clear `[Working...]` feedback during LLM processing

## Installation

Place this directory in `~/.pi/agents/extensions/pi-linear-mode-extension/`.

The extension will be auto-discovered by pi on startup.

## Usage

Once installed, the extension will automatically:
- Show numbered interactions for tool selection
- Render tool calls and results in a linear format
- Provide interactive selection dialogs
- Mark all UI/system messages with `[` and `]` brackets for screen readers
- Suppress frequently updating footer by default (screen reader friendly)
- Show `[Working...]` during LLM processing

### Commands

- `toggle-footer` - Toggle between empty footer (screen reader friendly) and default footer
- `footer-status` - Show snapshot of current footer status (context usage, model name)

### Accessibility Features

- **Bracket Formatting**: All UI/system messages use `[message]` format
- **Minimal Blank Lines**: Reduced spacing for cleaner screen reader output
- **Concise Lines**: Information combined on single lines when possible
- **Truncated Output**: Long lines truncated for screen reader efficiency
- **Clear Status**: Always shows processing status (`[Running...]`, `[Working...]`, `[Done]`)

See [ACCESSIBILITY_GUIDELINES.md](ACCESSIBILITY_GUIDELINES.md) for development guidelines.

## Development

The extension is written in TypeScript and uses pi's extension API.

### Structure

- `index.ts` - Main entry point
- `src/extensions/` - Individual extension modules
- `src/lib/` - Shared library code
- `package.json` - Extension metadata and dependencies
- `tsconfig.json` - TypeScript configuration

### Building

No build step is required - pi loads TypeScript extensions directly via jiti.

### Testing

Tests use Vitest and can be run with:

```bash
npm test          # Run tests once
npm run test:watch # Run tests in watch mode
npm run test:ui    # Run tests with UI
```

Tests are located in the `test/` directory and include:
- Formatting utilities (`formatting.test.ts`)
- Extension loading (`index.test.ts`)
- Renderer and accessibility behavior tests

## License

MIT