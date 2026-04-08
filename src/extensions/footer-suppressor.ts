import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { logger } from "../lib/logger.ts";

/**
 * Simple footer suppressor for pi-linear-mode.
 * 
 * Suppresses the default footer which shows context usage, token counts, and model info.
 * The footer updates frequently and causes extraneous screen reader speech.
 * 
 * This extension replaces the footer with an empty footer.
 */
export default function footerSuppressorSimple(pi: ExtensionAPI) {
  let footerEnabled = false;
  
  function setEmptyFooter(ctx: ExtensionContext) {
    // Create an empty footer
    ctx.ui.setFooter((_tui: any, _theme: any, _footerData: any) => {
      return {
        dispose: () => {},
        invalidate() {},
        render(_width: number): string[] {
          // Return empty array for completely silent footer
          return [];
        },
      };
    });
  }
  
  function restoreDefaultFooter(ctx: ExtensionContext) {
    ctx.ui.setFooter(undefined);
  }
  
  // Register command to toggle footer suppression
  pi.registerCommand("toggle-footer", {
    description: "Toggle footer suppression",
    handler: async (_args, ctx) => {
      try {
        footerEnabled = !footerEnabled;
        
        if (footerEnabled) {
          restoreDefaultFooter(ctx);
          ctx.ui.notify("[Footer restored]", "info");
        } else {
          setEmptyFooter(ctx);
          ctx.ui.notify("[Footer suppressed]", "info");
        }
      } catch (error) {
        ctx.ui.notify(`[Error toggling footer: ${error}]`, "error");
      }
    },
  });
  
  // Register command to show footer snapshot
  pi.registerCommand("footer-status", {
    description: "Show current footer status",
    handler: async (_args, ctx: ExtensionCommandContext) => {
      try {
        if (!(ctx as any).hasUI && (ctx as any).hasUI !== undefined) {
          return;
        }

        const modelName = ctx.model?.id || "no-model";

        // Get context usage if available
        const contextUsage = (ctx as any).session?.getContextUsage?.();
        const contextWindow = contextUsage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
        const contextPercent = contextUsage?.percent ?? 0;
        const contextPercentStr = contextPercent !== null ? contextPercent.toFixed(1) : "?";

        const statusLine = `Footer: context ${contextPercentStr} percent of ${contextWindow}k, model ${modelName}`;

        ctx.ui.notify(`[${statusLine}]`, "info");
      } catch (error) {
        ctx.ui.notify(`[Error getting footer status: ${error}]`, "error");
      }
    },
  });
  
  // Start with empty footer by default for accessibility
  pi.on("session_start", async (_event, ctx: ExtensionContext) => {
    try {
      setEmptyFooter(ctx);
    } catch (error) {
      // Log error but don't show notification on session start
      logger.error(`Error setting empty footer:`, error);
    }
  });
  
  pi.on("session_shutdown", async (_event, ctx: ExtensionContext) => {
    try {
      // Clean up
      restoreDefaultFooter(ctx);
    } catch (error) {
      logger.error(`Error restoring footer on shutdown:`, error);
    }
  });
}