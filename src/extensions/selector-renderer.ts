import type { ExtensionAPI, SelectorRenderer, SelectorItem, SelectorOptions } from "@mariozechner/pi-coding-agent";
import { Container, Text, Spacer } from "@mariozechner/pi-tui";

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
      
      // Number and label
      const prefix = isSelected ? "> " : "  ";
      const number = `[${i + 1}]`;
      const label = item.label.length > 50 ? item.label.substring(0, 47) + "..." : item.label;
      
      const line = `${prefix}${number} ${label}`;
      this.addChild(new Text(line, 0, 0));
      
      // Description if available
      if (item.description) {
        const desc = item.description.length > 60 ? item.description.substring(0, 57) + "..." : item.description;
        this.addChild(new Text(`      ${desc}`, 0, 0));
      }
      
      this.addChild(new Spacer(1));
    }

    // Add instructions
    this.addChild(new Spacer(1));
    this.addChild(new Text("Enter number (1-" + this.items.length + ") or press Esc to cancel", 0, 0));
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
  items,
  ui,
  onSelect,
  onCancel,
  options
) => {
  return new LinearSelectorComponent(items, onSelect, onCancel, options);
};

/**
 * Linear selector renderer for model selector (/model command).
 */
const linearModelSelectorRenderer: SelectorRenderer = (
  items,
  ui,
  onSelect,
  onCancel,
  options
) => {
  return new LinearSelectorComponent(items, onSelect, onCancel, options);
};

/**
 * Linear selector renderer for session selector (session switching).
 */
const linearSessionSelectorRenderer: SelectorRenderer = (
  items,
  ui,
  onSelect,
  onCancel,
  options
) => {
  return new LinearSelectorComponent(items, onSelect, onCancel, options);
};

/**
 * Linear selector renderer for OAuth login selector (/login command).
 */
const linearOAuthLoginSelectorRenderer: SelectorRenderer = (
  items,
  ui,
  onSelect,
  onCancel,
  options
) => {
  return new LinearSelectorComponent(items, onSelect, onCancel, options);
};

/**
 * Linear selector renderer for OAuth logout selector (/logout command).
 */
const linearOAuthLogoutSelectorRenderer: SelectorRenderer = (
  items,
  ui,
  onSelect,
  onCancel,
  options
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
  pi.registerSelectorRenderer("user-message", linearUserMessageSelectorRenderer);
  
  // Register linear renderer for model selector (/model command)
  pi.registerSelectorRenderer("model", linearModelSelectorRenderer);
  
  // Register linear renderer for session selector (session switching)
  pi.registerSelectorRenderer("session", linearSessionSelectorRenderer);
  
  // Register linear renderer for OAuth selectors
  pi.registerSelectorRenderer("oauth-login", linearOAuthLoginSelectorRenderer);
  pi.registerSelectorRenderer("oauth-logout", linearOAuthLogoutSelectorRenderer);
  
  // Log extension load for debugging
  pi.on("session_start", async (_event, ctx) => {
    console.error("[pi-linear-mode] Selector renderers registered for: user-message, model, session, oauth-login, oauth-logout");
    
    // Optional UI notification in interactive sessions
    if (ctx.hasUI) {
      ctx.ui.notify("Linear selector rendering enabled for multiple commands", "info");
    }
  });
}