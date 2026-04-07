# pi-linear-mode-extension

A pi extension that provides a more linear workflow inside the pi CLI with numbered interactions and custom renderers.

## Features

- **Numbered Interactions**: Tools are displayed with numbers for easy selection
- **Custom Tool Renderers**: Linear display of tool calls and results
- **Selector Renderer**: Interactive selection UI for choosing options
- **Bash Renderer**: Custom rendering for bash command output
- **Message Renderers**: Custom display for different message types
- **TUI Compatibility**: Compatibility layer for TUI interactions
- **Interaction Manager**: Handles user interactions in a linear flow
- **Abort Marker**: Tracks aborted operations

## Installation

Place this directory in `~/.pi/agents/extensions/pi-linear-mode-extension/`.

The extension will be auto-discovered by pi on startup.

## Usage

Once installed, the extension will automatically:
- Show numbered interactions for tool selection
- Render tool calls and results in a linear format
- Provide interactive selection dialogs
- Customize bash command output display

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

## License

MIT