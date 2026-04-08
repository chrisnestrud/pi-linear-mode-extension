import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Container, Text, Spacer, Input, fuzzyFilter } from "@mariozechner/pi-tui";
import { formatSelectorItem, formatUIMessage } from "../lib/formatting.ts";

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

function findTokenMatchIndices(token: string, text: string): number[] {
  const tokenLower = token.toLowerCase();
  const textLower = text.toLowerCase();
  const indices: number[] = [];
  let queryIndex = 0;

  for (let i = 0; i < textLower.length && queryIndex < tokenLower.length; i++) {
    if (textLower[i] === tokenLower[queryIndex]) {
      indices.push(i);
      queryIndex++;
    }
  }

  return queryIndex === tokenLower.length ? indices : [];
}

function findHighlightIndices(query: string, text: string): number[] {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);

  const indices = new Set<number>();
  for (const token of tokens) {
    const tokenIndices = findTokenMatchIndices(token, text);
    if (tokenIndices.length === 0) {
      return [];
    }

    for (const index of tokenIndices) {
      indices.add(index);
    }
  }

  return [...indices].sort((a, b) => a - b);
}

function inlineDescription(item: SelectorItem): string {
  if (!item.description) {
    return item.label;
  }

  const description = item.description.replace(/\s+/g, " ").trim();
  if (description.length === 0) {
    return item.label;
  }

  if (description.length <= 60) {
    return `${item.label} - ${description}`;
  }

  return item.label;
}

class LinearSelectorComponent extends Container {
  private items: SelectorItem[];
  private onSelect: (selectedId: string, selectedItem?: SelectorItem) => void;
  private onCancel: () => void;
  private options?: SelectorOptions;
  private selectedIndex = 0;
  private filterInput = new Input();

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
    this.filterInput.setValue("");
    this.renderSelector();
  }

  private get filterQuery(): string {
    return this.filterInput.getValue();
  }

  private getItemSearchText(item: SelectorItem): string {
    return [item.label, item.description, item.id]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" ");
  }

  private getVisibleItems(): SelectorItem[] {
    const query = this.filterQuery.trim();
    if (!query) {
      return this.items;
    }

    return fuzzyFilter(this.items, query, (item) => this.getItemSearchText(item));
  }

  private clampSelection(): void {
    const visibleItems = this.getVisibleItems();
    if (visibleItems.length === 0) {
      this.selectedIndex = 0;
      return;
    }

    if (this.selectedIndex >= visibleItems.length) {
      this.selectedIndex = visibleItems.length - 1;
    }
  }

  private clearFilter(): void {
    this.filterInput.setValue("");
    this.selectedIndex = 0;
  }

  private getDisplayedLabel(item: SelectorItem): string {
    return inlineDescription(item);
  }

  private renderSelector(): void {
    this.clear();
    this.clampSelection();
    const visibleItems = this.getVisibleItems();

    if (this.options?.title) {
      this.addChild(new Text(formatUIMessage(this.options.title), 0, 0));
    }

    this.addChild(new Text(formatUIMessage(`Filter: ${this.filterQuery || ""}`), 0, 0));

    if (visibleItems.length === 0) {
      this.addChild(new Text(formatUIMessage("No matches"), 0, 0));
    }

    for (let i = 0; i < visibleItems.length; i++) {
      const item = visibleItems[i];
      const isSelected = i === this.selectedIndex;
      const line = formatSelectorItem(i, this.getDisplayedLabel(item), isSelected);
      this.addChild(new Text(line, 0, 0));

      if (item.description && inlineDescription(item) === item.label) {
        this.addChild(new Text(formatUIMessage(`Description: ${item.description}`), 0, 0));
      }

      if (i < visibleItems.length - 1) {
        this.addChild(new Spacer(1));
      }
    }

    const instruction = this.filterQuery
      ? `Enter number (1-${visibleItems.length}) • Enter to select • Backspace edits filter • Ctrl+W deletes word • Ctrl+U clears filter • Esc clears filter, then cancels`
      : `Enter number (1-${visibleItems.length}) or press Esc to cancel • type to filter • Enter to select`;
    this.addChild(new Text(`[${instruction}]`, 0, 0));
  }

  handleKey(key: string): boolean {
    const visibleItems = this.getVisibleItems();

    if (key === "Escape" || key === "Esc" || key === "escape" || key === "\u001b") {
      if (this.filterQuery) {
        this.clearFilter();
        this.renderSelector();
      } else {
        this.onCancel();
      }
      return true;
    }

    if ((key === "ArrowUp" || key === "k") && visibleItems.length > 0) {
      this.selectedIndex = this.selectedIndex > 0 ? this.selectedIndex - 1 : visibleItems.length - 1;
      this.renderSelector();
      return true;
    }

    if ((key === "ArrowDown" || key === "j") && visibleItems.length > 0) {
      this.selectedIndex = this.selectedIndex < visibleItems.length - 1 ? this.selectedIndex + 1 : 0;
      this.renderSelector();
      return true;
    }

    if (this.filterQuery.length === 0) {
      const num = Number.parseInt(key, 10);
      if (!Number.isNaN(num) && num >= 1 && num <= visibleItems.length) {
        const item = visibleItems[num - 1];
        this.onSelect(item.id, item);
        return true;
      }
    }

    if (key === "Enter" || (key === " " && this.filterQuery.length === 0)) {
      const item = visibleItems[this.selectedIndex];
      if (!item) {
        return true;
      }

      this.onSelect(item.id, item);
      return true;
    }

    const before = this.filterQuery;
    this.filterInput.handleInput(key);
    if (this.filterQuery !== before) {
      this.selectedIndex = 0;
      this.renderSelector();
      return true;
    }

    if (key === " ") {
      const item = visibleItems[this.selectedIndex];
      if (!item) {
        return true;
      }

      this.onSelect(item.id, item);
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
