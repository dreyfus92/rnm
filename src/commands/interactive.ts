/**
 * Interactive mode: prompts for folder, find/replace, then preview and confirm.
 */

import { existsSync, statSync } from "node:fs";
import { styleText } from "node:util";
import * as p from "@clack/prompts";
import type { RenamePattern } from "../patterns-config.js";
import { BUILT_IN_PRESETS, readUserPatterns, appendUserPattern } from "../patterns-config.js";
import type { RenameEntry } from "../renamer.js";
import { applyRenames, computeNewNames, countFilesWithMatch, listFiles } from "../renamer.js";
import { formatPreview, PREVIEW_MAX_LINES } from "./common.js";
import { VERSION } from "../flags.js";

const INTRO_BANNER = `
  ██████╗  ███╗   ██╗ ███╗   ███╗               
  ██╔══██╗ ████╗  ██║ ████╗ ████║      
  ██████╔╝ ██╔██╗ ██║ ██╔████╔██║      
  ██╔══██╗ ██║╚██╗██║ ██║╚██╔╝██║      
  ██║  ██║ ██║ ╚████║ ██║ ╚═╝ ██║      
  ╚═╝  ╚═╝ ╚═╝  ╚═══╝ ╚═╝     ╚═╝
`;

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
  // Print banner directly so Clack doesn't reflow/wrap it and break the layout
  // TODO: check if this can be resolved withGuide prop in the upcoming release of Clack
  console.log(styleText(["bold", "green"], INTRO_BANNER));
  p.intro(styleText(["bold", "magenta"], `Interactive batch file renamer - v${VERSION}`));

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

  let find: string;
  let replace: string;
  let isCustomPattern = false;

  if (isRegex) {
    const userPatterns = await readUserPatterns();
    const combined: RenamePattern[] = [...BUILT_IN_PRESETS, ...userPatterns];
    const presetOptions = combined.map((pat, i) => ({
      value: String(i),
      label: pat.name,
    }));
    presetOptions.push({ value: "custom", label: "Custom…" });

    const patternChoice = await p.select({
      message: "Choose a pattern",
      options: presetOptions,
    });
    if (p.isCancel(patternChoice)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }
    const choice = patternChoice as string;

    if (choice === "custom") {
      isCustomPattern = true;
      const findResult = await p.text({
        message: "Find pattern",
        placeholder: "e.g. /\\d+/ or photo_",
      });
      exitIfCancel(findResult);
      find = findResult;
      const replaceResult = await p.text({
        message: "Replace with",
        placeholder: "$1",
      });
      exitIfCancel(replaceResult);
      replace = replaceResult;
    } else {
      const preset = combined[Number.parseInt(choice, 10)];
      find = preset.find;
      replace = preset.replace;
    }
  } else {
    const findResult = await p.text({
      message: "Find pattern",
      placeholder: "e.g. photo_",
    });
    exitIfCancel(findResult);
    find = findResult;
    const replaceResult = await p.text({
      message: "Replace with",
      placeholder: "$1",
    });
    exitIfCancel(replaceResult);
    replace = replaceResult;
  }

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

  if (isCustomPattern) {
    const saveResult = await p.confirm({
      message: "Save this pattern to your list?",
      initialValue: false,
    });
    if (!p.isCancel(saveResult) && saveResult) {
      const nameResult = await p.text({
        message: "Pattern name",
        placeholder: "e.g. My custom pattern",
      });
      if (!p.isCancel(nameResult) && typeof nameResult === "string" && nameResult.trim()) {
        try {
          await appendUserPattern(nameResult.trim(), find, replace);
          p.log.success(`Saved as "${nameResult.trim()}".`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          p.log.error(`Could not save pattern: ${msg}`);
        }
      }
    }
  }

  p.note("Files updated.", "Done");
  p.outro(styleText("green", "Done."));
}
