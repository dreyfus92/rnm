#!/usr/bin/env node
/**
 * rnm – interactive batch file renamer CLI
 * Entry: intro, path, find/replace prompts, preview, confirm, spinner, renamer, outro.
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import { existsSync, statSync } from "node:fs";
import {
  listFiles,
  computeNewNames,
  applyRenames,
  type RenameEntry,
} from "./renamer.js";

const PREVIEW_MAX_LINES = 20;

function exitIfCancel(value: unknown): asserts value is string | boolean {
  if (p.isCancel(value)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }
}

function exitIfCancelSelect<T>(value: unknown): T {
  if (p.isCancel(value)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }
  return value as T;
}

async function main(): Promise<void> {
  p.intro(pc.bold(pc.cyan("rnm")));

  const dirResult = await p.text({
    message: "Folder to rename files in",
    placeholder: "e.g. . or ./photos",
    initialValue: process.cwd(),
  });
  exitIfCancel(dirResult);
  const dir = dirResult.trim() || process.cwd();

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
  const matchType = exitIfCancelSelect<"literal" | "regex">(matchTypeResult);
  const isRegex = matchType === "regex";

  const findResult = await p.text({
    message: "Find pattern",
    placeholder: isRegex ? "e.g. /\\d+/ or photo_" : "e.g. photo_",
  });
  exitIfCancel(findResult);
  const find = findResult;

  const replaceResult = await p.text({
    message: "Replace with",
    placeholder: "$1",
  });
  exitIfCancel(replaceResult);
  const replace = replaceResult;

  let renames: RenameEntry[];
  try {
    renames = computeNewNames(files, find, replace, isRegex);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    p.log.error(msg);
    process.exit(1);
    renames = []; // unreachable; helps TS narrow
  }

  if (renames.length === 0) {
    p.log.message("No renames to perform (no matches). Exiting.");
    process.exit(0);
  }

  const previewLines = renames.slice(0, PREVIEW_MAX_LINES).map(
    (r) => `${r.oldName} → ${r.newName}`
  );
  if (renames.length > PREVIEW_MAX_LINES) {
    previewLines.push(`… and ${renames.length - PREVIEW_MAX_LINES} more`);
  }
  p.note(previewLines.join("\n"), "Preview");

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
  } catch (err) {
    s.stop("Failed.", 1);
    const msg = err instanceof Error ? err.message : String(err);
    p.log.error(msg);
    process.exit(1);
  }

  p.note("Files updated.", "Done");
  p.outro(pc.green("Done."));
}

main();
