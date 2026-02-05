/**
 * Script mode: non-interactive rename via --dir, --find, --replace.
 */

import { existsSync, statSync } from "node:fs";
import type { ParsedArgs } from "../flags.js";
import type { RenameEntry } from "../renamer.js";
import { applyRenames, computeNewNames, listFiles } from "../renamer.js";
import { formatPreview, PREVIEW_MAX_LINES } from "./common.js";

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    console.error(`Error: Directory does not exist: ${dir}`);
    process.exit(1);
  }
  if (!statSync(dir).isDirectory()) {
    console.error(`Error: Not a directory: ${dir}`);
    process.exit(1);
  }
}

export function runScriptMode(args: ParsedArgs): void {
  const { dir, find, replace, dryRun, yes, literal } = args;
  if (dir === undefined || find === undefined || replace === undefined) {
    console.error("Error: Script mode requires --dir, --find, and --replace together.");
    process.exit(1);
  }
  ensureDir(dir);
  const files = listFiles(dir);
  if (files.length === 0) {
    console.log("No files in that folder.");
    process.exit(0);
  }
  const isRegex = !literal;
  let renames: RenameEntry[];
  try {
    renames = computeNewNames(files, find, replace, isRegex);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Error:", msg);
    process.exit(1);
  }
  if (renames.length === 0) {
    console.log("No renames to perform (no matches).");
    process.exit(0);
  }
  console.log(formatPreview(renames, PREVIEW_MAX_LINES));
  if (dryRun) {
    process.exit(0);
  }
  if (!yes) {
    console.error("Use --yes to apply renames in script mode.");
    process.exit(1);
  }
  try {
    applyRenames(dir, renames);
    console.log("Done.");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Error:", msg);
    process.exit(1);
  }
}
