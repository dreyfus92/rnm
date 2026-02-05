/**
 * Regex presets: built-in patterns and global user config (~/.rnm/patterns.json).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface RenamePattern {
  name: string;
  find: string;
  replace: string;
}

/**
 * Built-in presets based on common batch-rename use cases (PowerRename, Bulk Rename
 * Utility, mmv, and common "clean filename" / regex-rename patterns).
 */

// TODO: do some research on common batch-rename use cases and add more presets
export const BUILT_IN_PRESETS: RenamePattern[] = [
  { name: "Remove digits", find: "\\d+", replace: "" },
  { name: "Spaces to underscores", find: "\\s+", replace: "_" },
  { name: "Spaces to hyphens", find: "\\s+", replace: "-" },
  { name: "Remove leading/trailing spaces", find: "^\\s+|\\s+$", replace: "" },
  { name: "Multiple spaces to single space", find: "\\s{2,}", replace: " " },
  { name: "Remove brackets only", find: "[\\[\\]]", replace: "" },
  { name: "Remove parentheses only", find: "[()]", replace: "" },
  { name: "Replace special characters with underscore", find: "[^a-zA-Z0-9._-]+", replace: "_" },
  { name: "Remove leading zeros", find: "^0+(?=\\d)", replace: "" },
];

const RNM_DIR = join(homedir(), ".rnm");
const PATTERNS_PATH = join(RNM_DIR, "patterns.json");

function isValidEntry(obj: unknown): obj is RenamePattern {
  if (obj === null || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.name === "string" &&
    o.name.length > 0 &&
    typeof o.find === "string" &&
    typeof o.replace === "string"
  );
}

/**
 * Load user patterns from ~/.rnm/patterns.json. Returns [] if file missing or invalid.
 */
export async function readUserPatterns(): Promise<RenamePattern[]> {
  try {
    const raw = await readFile(PATTERNS_PATH, "utf-8");
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const out: RenamePattern[] = [];
    for (const entry of data) {
      if (isValidEntry(entry)) out.push(entry);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Append one pattern to the user file. Creates ~/.rnm if needed. Throws on write error.
 */
export async function appendUserPattern(
  name: string,
  find: string,
  replace: string,
): Promise<void> {
  const current = await readUserPatterns();
  current.push({ name, find, replace });
  await mkdir(RNM_DIR, { recursive: true });
  await writeFile(PATTERNS_PATH, JSON.stringify(current, null, 2), "utf-8");
}
