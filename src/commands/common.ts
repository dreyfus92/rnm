/**
 * Shared utilities for script and interactive commands.
 */

import type { RenameEntry } from "../renamer.js";

export const PREVIEW_MAX_LINES = 20;

export function formatPreview(renames: readonly RenameEntry[], maxLines: number): string {
  const lines = renames.slice(0, maxLines).map((r) => `${r.oldName} → ${r.newName}`);
  if (renames.length > maxLines) {
    lines.push(`… and ${renames.length - maxLines} more`);
  }
  return lines.join("\n");
}
