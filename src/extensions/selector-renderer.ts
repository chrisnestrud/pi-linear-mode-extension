import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Container, Text, Spacer } from "@mariozechner/pi-tui";
import { formatSelectorItem } from "../lib/formatting.ts";

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
  options?: SelectorOptions,
) => any;

class LinearSelectorComponent extends Container {
  private items: SelectorItem[];
  private onSelect: (selectedId: string, selectedItem?: SelectorItem) => void;
  private onCancel: () => void;
  private options?: SelectorOptions;
  private selectedIndex = 0;

  constructor(
    items: SelectorItem[],
    onSelect: (selectedId: string, selectedItem?: SelectorItem) => void,
    onCancel: () => void,
    options?: SelectorOptions,
  ) {
    super();
    this.items = items;
    this.onSelect = onSelect;
    this.onCancel = onCancel;
    this.options = options;
    this.renderSelector();
  }

  private renderSelector(): void {
    this.clear();

    if (this.options?.title) {
      this.addChild(new Text(this.options.title, 0, 0));
      this.addChild(new Spacer(1));
    }

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const isSelected = i === this.selectedIndex;
      const line = formatSelectorItem(i, item.label, isSelected);
      this.addChild(new Text(line, 0, 0));

      if (item.description) {
        this.addChild(new Text(`    ${item.description}`, 0, 0));
      }

      if (i < this.items.length - 1) {
        this.addChild(new Spacer(1));
      }
    }

    const instruction = `Enter number (1-${this.items.length}) or press Esc to cancel`;
    this.addChild(new Text(`[${instruction}]`, 0, 0));
  }

  handleKey(key: string): boolean {
    const num = parseInt(key);
    if (!isNaN(num) && num >= 1 && num <= this.items.length) {
      const item = this.items[num - 1];
      this.onSelect(item.id, item);
      return true;
    }

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

    if (key === "Enter" || key === " ") {
      const item = this.items[this.selectedIndex];
      this.onSelect(item.id, item);
      return true;
    }

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

const linearUserMessageSelectorRenderer: SelectorRenderer = (items, ui, onSelect, onCancel, options) => {
  return new LinearSelectorComponent(items, onSelect, onCancel, options);
};

const linearModelSelectorRenderer: SelectorRenderer = (items, ui, onSelect, onCancel, options) => {
  return new LinearSelectorComponent(items, onSelect, onCancel, options);
};

const linearSessionSelectorRenderer: SelectorRenderer = (items, ui, onSelect, onCancel, options) => {
  return new LinearSelectorComponent(items, onSelect, onCancel, options);
};

const linearOAuthLoginSelectorRenderer: SelectorRenderer = (items, ui, onSelect, onCancel, options) => {
  return new LinearSelectorComponent(items, onSelect, onCancel, options);
};

const linearOAuthLogoutSelectorRenderer: SelectorRenderer = (items, ui, onSelect, onCancel, options) => {
  return new LinearSelectorComponent(items, onSelect, onCancel, options);
};

export default function selectorRendererExtension(pi: ExtensionAPI) {
  (pi as any).registerSelectorRenderer("user-message", linearUserMessageSelectorRenderer);
  (pi as any).registerSelectorRenderer("model", linearModelSelectorRenderer);
  (pi as any).registerSelectorRenderer("session", linearSessionSelectorRenderer);
  (pi as any).registerSelectorRenderer("oauth-login", linearOAuthLoginSelectorRenderer);
  (pi as any).registerSelectorRenderer("oauth-logout", linearOAuthLogoutSelectorRenderer);

  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      ctx.ui.notify("[Linear selector rendering enabled]", "info");
    }
  });
}
