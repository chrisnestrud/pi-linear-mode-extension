import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Container, Text, Spacer } from "@mariozechner/pi-tui";
import { formatSelectorItem, truncateForScreenReader } from "../lib/formatting.ts";

// Define local types since they might not be exported
interface SelectorItem {
  id: string;
  label: string;
  description?: string;
  data?: any;
}

interface SelectorOptions {
  title?: string;
  multiSelect?: boolean;
  initialSelection?: string;
  [key: string]: any;
}

type SelectorRenderer = (
  items: SelectorItem[],
  ui: any,
  onSelect: (selectedId: string, selectedItem?: SelectorItem) => void,
  onCancel: () => void,
  options?: SelectorOptions
) => any;

/**
 * Linear selector component for pi-linear-mode.
 * 
 * Provides a numbered, linear interface for selectors instead of multi-column layout.
 * This is screen-reader friendly and matches the linear workflow aesthetic.
 */
class LinearSelectorComponent extends Container {
  private items: SelectorItem[];
  private onSelect: (selectedId: string, selectedItem?: SelectorItem) => void;
  private onCancel: () => void;
  private options?: SelectorOptions;
  private selectedIndex: number = 0;

  constructor(
    items: SelectorItem[],
    onSelect: (selectedId: string, selectedItem?: SelectorItem) => void,
    onCancel: () => void,
    options?: SelectorOptions
  ) {
    super();
    this.items = items;
    this.onSelect = onSelect;
    this.onCancel = onCancel;
    this.options = options;

    // Initial render
    this.renderSelector();
  }

  private renderSelector(): void {
    this.clear();
    
    // Add title if provided
    if (this.options?.title) {
      this.addChild(new Text(this.options.title, 0, 0));
      this.addChild(new Spacer(1));
    }

    // Render numbered items
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const isSelected = i === this.selectedIndex;
      
      // Number and label (truncated for screen readers)
      const truncatedLabel = truncateForScreenReader(item.label, 60);
      const line = formatSelectorItem(i, truncatedLabel, isSelected);
      this.addChild(new Text(line, 0, 0));
      
      // Description if available (on same line if short)
      if (item.description) {
        const truncatedDesc = truncateForScreenReader(item.description, 50);
        if (truncatedDesc.length <= 50) {
          // Add to same line
          this.addChild(new Text(` - ${truncatedDesc}`, 0, 0));
        } else {
          // On next line
          this.addChild(new Text(`    ${truncatedDesc}`, 0, 0));
        }
      }
      
      // Only add spacer between items, not after last one
      if (i < this.items.length - 1) {
        this.addChild(new Spacer(1));
      }
    }

    // Add instructions (on same line if possible)
    const instruction = `Enter number (1-${this.items.length}) or press Esc to cancel`;
    this.addChild(new Text(`[${instruction}]`, 0, 0));
  }

  handleKey(key: string): boolean {
    // Handle number keys
    const num = parseInt(key);
    if (!isNaN(num) && num >= 1 && num <= this.items.length) {
      const item = this.items[num - 1];
      this.onSelect(item.id, item);
      return true;
    }

    // Handle arrow keys
    if (key === "ArrowUp" || key === "k") {
      this.selectedIndex = this.selectedIndex > 0 ? this.selectedIndex - 1 : this.items.length - 1;
      this.renderSelector();
      return true;
    }
    
    if (key === "ArrowDown" || key === "j") {
      this.selectedIndex = this.selectedIndex < this.items.length - 1 ? this.selectedIndex + 1 : 0;
      this.renderSelector();
      return true;
    }

    // Handle Enter on selected item
    if (key === "Enter" || key === " ") {
      const item = this.items[this.selectedIndex];
      this.onSelect(item.id, item);
      return true;
    }

    // Handle Escape
    if (key === "Escape") {
      this.onCancel();
      return true;
    }

    return false;
  }

  invalidate(): void {
    this.renderSelector();
  }
}

/**
 * Linear selector renderer for user-message selector (/fork command).
 * 
 * Replaces the default multi-column selector with a numbered linear interface.
 */
const linearUserMessageSelectorRenderer: SelectorRenderer = (
  items: SelectorItem[],
  ui: any,
  onSelect: (selectedId: string, selectedItem?: SelectorItem) => void,
  onCancel: () => void,
  options?: SelectorOptions
) => {
  return new LinearSelectorComponent(items, onSelect, onCancel, options);
};

/**
 * Linear selector renderer for model selector (/model command).
 */
const linearModelSelectorRenderer: SelectorRenderer = (
  items: SelectorItem[],
  ui: any,
  onSelect: (selectedId: string, selectedItem?: SelectorItem) => void,
  onCancel: () => void,
  options?: SelectorOptions
) => {
  return new LinearSelectorComponent(items, onSelect, onCancel, options);
};

/**
 * Linear selector renderer for session selector (session switching).
 */
const linearSessionSelectorRenderer: SelectorRenderer = (
  items: SelectorItem[],
  ui: any,
  onSelect: (selectedId: string, selectedItem?: SelectorItem) => void,
  onCancel: () => void,
  options?: SelectorOptions
) => {
  return new LinearSelectorComponent(items, onSelect, onCancel, options);
};

/**
 * Linear selector renderer for OAuth login selector (/login command).
 */
const linearOAuthLoginSelectorRenderer: SelectorRenderer = (
  items: SelectorItem[],
  ui: any,
  onSelect: (selectedId: string, selectedItem?: SelectorItem) => void,
  onCancel: () => void,
  options?: SelectorOptions
) => {
  return new LinearSelectorComponent(items, onSelect, onCancel, options);
};

/**
 * Linear selector renderer for OAuth logout selector (/logout command).
 */
const linearOAuthLogoutSelectorRenderer: SelectorRenderer = (
  items: SelectorItem[],
  ui: any,
  onSelect: (selectedId: string, selectedItem?: SelectorItem) => void,
  onCancel: () => void,
  options?: SelectorOptions
) => {
  return new LinearSelectorComponent(items, onSelect, onCancel, options);
};

/**
 * Selector renderer extension for pi-linear-mode.
 * 
 * Registers custom renderers for selector dialogs to provide linear,
 * numbered interfaces instead of multi-column layouts.
 */
export default function selectorRendererExtension(pi: ExtensionAPI) {
  // Register linear renderer for user-message selector (/fork command)
  (pi as any).registerSelectorRenderer("user-message", linearUserMessageSelectorRenderer);
  
  // Register linear renderer for model selector (/model command)
  (pi as any).registerSelectorRenderer("model", linearModelSelectorRenderer);
  
  // Register linear renderer for session selector (session switching)
  (pi as any).registerSelectorRenderer("session", linearSessionSelectorRenderer);
  
  // Register linear renderer for OAuth selectors
  (pi as any).registerSelectorRenderer("oauth-login", linearOAuthLoginSelectorRenderer);
  (pi as any).registerSelectorRenderer("oauth-logout", linearOAuthLogoutSelectorRenderer);
  
  // Optional UI notification in interactive sessions
  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      ctx.ui.notify("[Linear selector rendering enabled]", "info");
    }
  });
}