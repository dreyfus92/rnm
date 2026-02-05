/**
 * Interactive mode: prompts for folder, find/replace, then preview and confirm.
 */

import { existsSync, statSync } from "node:fs";
import { styleText } from "node:util";
import * as p from "@clack/prompts";
import type { RenameEntry } from "../renamer.js";
import { applyRenames, computeNewNames, countFilesWithMatch, listFiles } from "../renamer.js";
import { formatPreview, PREVIEW_MAX_LINES } from "./common.js";

function exitIfCancel(value: unknown): asserts value is string | boolean {
  if (p.isCancel(value)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }
}

function exitIfCancelSelect(value: unknown): "literal" | "regex" {
  if (p.isCancel(value)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }
  if (value !== "literal" && value !== "regex") {
    p.cancel("Cancelled.");
    process.exit(0);
  }
  return value;
}

export async function runInteractive(dryRun: boolean): Promise<void> {
  p.intro(styleText(["bold", "cyan"], "rnm"));

  const dirResult = await p.path({
    message: "Folder to rename files in",
    directory: true,
    initialValue: process.cwd(),
  });
  exitIfCancel(dirResult);
  if (typeof dirResult !== "string") {
    p.cancel("Cancelled.");
    process.exit(0);
  }
  const dir = dirResult;

  if (!existsSync(dir)) {
    p.log.error(`Directory does not exist: ${dir}`);
    process.exit(1);
  }
  if (!statSync(dir).isDirectory()) {
    p.log.error(`Not a directory: ${dir}`);
    process.exit(1);
  }
  const files = listFiles(dir);
  if (files.length === 0) {
    p.log.message("No files in that folder. Exiting.");
    process.exit(0);
  }

  const matchTypeResult = await p.select({
    message: "Match type",
    options: [
      { value: "literal", label: "Literal (exact text)" },
      { value: "regex", label: "Regex" },
    ],
  });
  const matchType = exitIfCancelSelect(matchTypeResult);
  const isRegex = matchType === "regex";

  const findResult = await p.text({
    message: "Find pattern",
    placeholder: isRegex ? "e.g. /\\d+/ or photo_" : "e.g. photo_",
  });
  exitIfCancel(findResult);
  const find = findResult;

  let matchCount: number;
  try {
    matchCount = countFilesWithMatch(files, find, isRegex);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    p.log.error(msg);
    process.exit(1);
  }

  if (matchCount === 0) {
    p.outro(styleText("yellow", "No renames to perform (no matches). Exiting."));
    process.exit(0);
  }

  const replaceResult = await p.text({
    message: "Replace with",
    placeholder: "$1",
  });
  exitIfCancel(replaceResult);
  const replace = replaceResult;

  let renames: RenameEntry[];
  try {
    renames = computeNewNames(files, find, replace, isRegex);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    p.log.error(msg);
    process.exit(1);
  }

  if (renames.length === 0) {
    p.outro(styleText("yellow", "No renames to perform (no matches). Exiting."));
    process.exit(0);
  }

  p.note(formatPreview(renames, PREVIEW_MAX_LINES), "Preview");

  if (dryRun) {
    p.note("Dry run: no files were renamed.", "Done");
    p.outro(styleText("green", "Done."));
    process.exit(0);
  }

  const confirmResult = await p.confirm({
    message: "Rename these files?",
    initialValue: false,
  });
  exitIfCancel(confirmResult);
  if (!confirmResult) {
    p.cancel("Rename cancelled.");
    process.exit(0);
  }

  const s = p.spinner();
  s.start("Renaming…");
  try {
    applyRenames(dir, renames);
    s.stop("Done.");
  } catch (err: unknown) {
    s.stop("Failed.");
    const msg = err instanceof Error ? err.message : String(err);
    p.log.error(msg);
    process.exit(1);
  }

  p.note("Files updated.", "Done");
  p.outro(styleText("green", "Done."));
}
