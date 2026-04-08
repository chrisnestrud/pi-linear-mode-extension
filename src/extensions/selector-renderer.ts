import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Container, Text, Spacer } from "@mariozechner/pi-tui";
import { formatSelectorItem } from "../lib/formatting.ts";

interface FuzzyMatch {
  matches: boolean;
  score: number;
  indices: number[];
}

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

function fuzzyMatch(query: string, text: string): FuzzyMatch {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  const matchQuery = (normalizedQuery: string): FuzzyMatch => {
    if (normalizedQuery.length === 0) {
      return { matches: true, score: 0, indices: [] };
    }

    if (normalizedQuery.length > textLower.length) {
      return { matches: false, score: 0, indices: [] };
    }

    let queryIndex = 0;
    let score = 0;
    let lastMatchIndex = -1;
    let consecutiveMatches = 0;
    const indices: number[] = [];

    for (let i = 0; i < textLower.length && queryIndex < normalizedQuery.length; i++) {
      if (textLower[i] === normalizedQuery[queryIndex]) {
        const isWordBoundary = i === 0 || /[\s\-_./:]/.test(textLower[i - 1]!);

        if (lastMatchIndex === i - 1) {
          consecutiveMatches++;
          score -= consecutiveMatches * 5;
        } else {
          consecutiveMatches = 0;
          if (lastMatchIndex >= 0) {
            score += (i - lastMatchIndex - 1) * 2;
          }
        }

        if (isWordBoundary) {
          score -= 10;
        }

        score += i * 0.1;
        lastMatchIndex = i;
        indices.push(i);
        queryIndex++;
      }
    }

    if (queryIndex < normalizedQuery.length) {
      return { matches: false, score: 0, indices: [] };
    }

    return { matches: true, score, indices };
  };

  const primaryMatch = matchQuery(queryLower);
  if (primaryMatch.matches) {
    return primaryMatch;
  }

  const alphaNumericMatch = queryLower.match(/^(?<letters>[a-z]+)(?<digits>[0-9]+)$/);
  const numericAlphaMatch = queryLower.match(/^(?<digits>[0-9]+)(?<letters>[a-z]+)$/);
  const swappedQuery = alphaNumericMatch
    ? `${alphaNumericMatch.groups?.digits ?? ""}${alphaNumericMatch.groups?.letters ?? ""}`
    : numericAlphaMatch
      ? `${numericAlphaMatch.groups?.letters ?? ""}${numericAlphaMatch.groups?.digits ?? ""}`
      : "";

  if (!swappedQuery) {
    return primaryMatch;
  }

  const swappedMatch = matchQuery(swappedQuery);
  if (!swappedMatch.matches) {
    return primaryMatch;
  }

  return { matches: true, score: swappedMatch.score + 5, indices: swappedMatch.indices };
}

function fuzzyMatchWithTokens(query: string, text: string): FuzzyMatch {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return { matches: true, score: 0, indices: [] };
  }

  let totalScore = 0;
  const combinedIndices = new Set<number>();

  for (const token of tokens) {
    const match = fuzzyMatch(token, text);
    if (!match.matches) {
      return { matches: false, score: 0, indices: [] };
    }

    totalScore += match.score;
    for (const index of match.indices) {
      combinedIndices.add(index);
    }
  }

  return {
    matches: true,
    score: totalScore,
    indices: [...combinedIndices].sort((a, b) => a - b),
  };
}

function highlightMatches(text: string, indices: number[]): string {
  if (indices.length === 0) {
    return text;
  }

  const highlighted = new Set(indices);
  let result = "";
  let open = false;

  for (let i = 0; i < text.length; i++) {
    const isMatch = highlighted.has(i);
    if (isMatch && !open) {
      result += "‹";
      open = true;
    }
    if (!isMatch && open) {
      result += "›";
      open = false;
    }
    result += text[i];
  }

  if (open) {
    result += "›";
  }

  return result;
}

class LinearSelectorComponent extends Container {
  private items: SelectorItem[];
  private onSelect: (selectedId: string, selectedItem?: SelectorItem) => void;
  private onCancel: () => void;
  private options?: SelectorOptions;
  private selectedIndex = 0;
  private filterQuery = "";

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

  private getItemSearchText(item: SelectorItem): string {
    return [item.label, item.description, item.id]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" ");
  }

  private getVisibleItems(): SelectorItem[] {
    if (!this.filterQuery.trim()) {
      return this.items;
    }

    return this.items
      .map((item) => ({ item, match: fuzzyMatchWithTokens(this.filterQuery, this.getItemSearchText(item)) }))
      .filter((entry) => entry.match.matches)
      .sort((a, b) => a.match.score - b.match.score)
      .map((entry) => entry.item);
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

  private isPrintableCharacter(key: string): boolean {
    return key.length === 1 && key >= " " && key !== "\u007f";
  }

  private clearFilter(): void {
    this.filterQuery = "";
    this.selectedIndex = 0;
  }

  private deleteFilterWordBackward(): boolean {
    if (this.filterQuery.length === 0) {
      return false;
    }

    let end = this.filterQuery.length;
    while (end > 0 && /\s/.test(this.filterQuery[end - 1]!)) {
      end--;
    }

    let start = end;
    while (start > 0 && !/\s/.test(this.filterQuery[start - 1]!)) {
      start--;
    }

    this.filterQuery = this.filterQuery.slice(0, start);
    this.selectedIndex = 0;
    return true;
  }

  private getHighlightedLabel(item: SelectorItem): string {
    if (!this.filterQuery.trim()) {
      return item.label;
    }

    const match = fuzzyMatchWithTokens(this.filterQuery, item.label);
    if (!match.matches) {
      return item.label;
    }

    return highlightMatches(item.label, match.indices);
  }

  private renderSelector(): void {
    this.clear();
    this.clampSelection();
    const visibleItems = this.getVisibleItems();

    if (this.options?.title) {
      this.addChild(new Text(this.options.title, 0, 0));
    }

    this.addChild(new Text(`Filter: ${this.filterQuery || ""}`, 0, 0));

    if (visibleItems.length === 0) {
      this.addChild(new Text("  No matches", 0, 0));
    }

    for (let i = 0; i < visibleItems.length; i++) {
      const item = visibleItems[i];
      const isSelected = i === this.selectedIndex;
      const line = formatSelectorItem(i, this.getHighlightedLabel(item), isSelected);
      this.addChild(new Text(line, 0, 0));

      if (item.description) {
        this.addChild(new Text(`    ${item.description}`, 0, 0));
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

    if (key === "\u0015") {
      if (!this.filterQuery) {
        return false;
      }

      this.clearFilter();
      this.renderSelector();
      return true;
    }

    if (key === "\u0017") {
      const changed = this.deleteFilterWordBackward();
      if (!changed) {
        return false;
      }

      this.renderSelector();
      return true;
    }

    if (key === "Backspace") {
      if (this.filterQuery.length === 0) {
        return false;
      }

      this.filterQuery = this.filterQuery.slice(0, -1);
      this.selectedIndex = 0;
      this.renderSelector();
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

    if (key === " " && this.filterQuery.length > 0) {
      this.filterQuery += key;
      this.selectedIndex = 0;
      this.renderSelector();
      return true;
    }

    if (key === "Enter" || key === " ") {
      const item = visibleItems[this.selectedIndex];
      if (!item) {
        return true;
      }

      this.onSelect(item.id, item);
      return true;
    }

    if (this.isPrintableCharacter(key)) {
      this.filterQuery += key;
      this.selectedIndex = 0;
      this.renderSelector();
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
