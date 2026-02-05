#!/usr/bin/env node
/**
 * rnm – interactive batch file renamer CLI
 * Supports --help, --version, --dry-run, and script mode (--dir, --find, --replace, --yes, --literal).
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

const VERSION = "0.1.0";
const PREVIEW_MAX_LINES = 20;

interface ParsedArgs {
  help: boolean;
  version: boolean;
  dryRun: boolean;
  dir: string | undefined;
  find: string | undefined;
  replace: string | undefined;
  yes: boolean;
  literal: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    help: false,
    version: false,
    dryRun: false,
    dir: undefined,
    find: undefined,
    replace: undefined,
    yes: false,
    literal: false,
  };
  const take = (i: number): string | undefined => argv[i];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") out.help = true;
    else if (arg === "-v" || arg === "--version") out.version = true;
    else if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "-y" || arg === "--yes") out.yes = true;
    else if (arg === "--literal") out.literal = true;
    else if (arg === "--dir" && take(i + 1)) {
      out.dir = take(i + 1);
      i++;
    } else if (arg === "--find" && take(i + 1)) {
      out.find = take(i + 1);
      i++;
    } else if (arg === "--replace") {
      out.replace = take(i + 1) ?? "";
      i++;
    }
  }
  return out;
}

function printHelp(): void {
  const usage = `rnm – batch rename files in a folder (interactive or script mode)

Usage:
  rnm                    Interactive mode (prompts for folder, find, replace)
  rnm --help             Show this help
  rnm --version          Show version
  rnm --dry-run          Interactive mode, show preview only (no rename)
  rnm --dir <path> --find <pattern> --replace <string> [options]   Script mode

Script mode options:
  --dir <path>           Directory to rename files in (required with --find/--replace)
  --find <pattern>       Find pattern (literal or regex; use --literal for exact text)
  --replace <string>     Replace string (use $1, $2 for regex groups)
  --yes, -y              Apply renames without confirmation
  --dry-run              Show preview only, do not rename
  --literal              Treat find pattern as literal text (default: regex)

Examples:
  rnm
  rnm --dry-run
  rnm --dir . --find "photo_" --replace "img_" --dry-run
  rnm --dir ./files --find "\\d+" --replace "X" --literal --yes`;
  console.log(usage);
}

function printVersion(): void {
  console.log(VERSION);
}

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

function formatPreview(renames: readonly RenameEntry[], maxLines: number): string {
  const lines = renames.slice(0, maxLines).map((r) => `${r.oldName} → ${r.newName}`);
  if (renames.length > maxLines) {
    lines.push(`… and ${renames.length - maxLines} more`);
  }
  return lines.join("\n");
}

function runScriptMode(args: ParsedArgs): void {
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
  } catch (err) {
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Error:", msg);
    process.exit(1);
  }
}

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

async function runInteractive(dryRun: boolean): Promise<void> {
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
    renames = [];
  }

  if (renames.length === 0) {
    p.log.message("No renames to perform (no matches). Exiting.");
    process.exit(0);
  }

  p.note(formatPreview(renames, PREVIEW_MAX_LINES), "Preview");

  if (dryRun) {
    p.note("Dry run: no files were renamed.", "Done");
    p.outro(pc.green("Done."));
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
  } catch (err) {
    s.stop("Failed.", 1);
    const msg = err instanceof Error ? err.message : String(err);
    p.log.error(msg);
    process.exit(1);
  }

  p.note("Files updated.", "Done");
  p.outro(pc.green("Done."));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (args.version) {
    printVersion();
    process.exit(0);
  }

  const scriptMode =
    args.dir !== undefined || args.find !== undefined || args.replace !== undefined;
  if (scriptMode) {
    runScriptMode(args);
    return;
  }

  await runInteractive(args.dryRun);
}

main();
