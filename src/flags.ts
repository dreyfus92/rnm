/**
 * CLI flag parsing and usage/version output.
 */

import { parse } from "@bomb.sh/args";

const VERSION = "0.1.0";

export interface ParsedArgs {
  help: boolean;
  version: boolean;
  dryRun: boolean;
  dir: string | undefined;
  find: string | undefined;
  replace: string | undefined;
  yes: boolean;
  literal: boolean;
}

const ARGS_CONFIG = {
  boolean: ["help", "version", "dry-run", "yes", "literal"] as const,
  string: ["dir", "find", "replace"] as const,
  alias: { h: "help", v: "version", y: "yes" } as const,
};

export function parseArgs(argv: string[]): ParsedArgs {
  const raw = parse(argv, ARGS_CONFIG);
  return {
    help: Boolean(raw.help),
    version: Boolean(raw.version),
    dryRun: Boolean(raw["dry-run"]),
    dir: raw.dir,
    find: raw.find,
    replace: raw.replace,
    yes: Boolean(raw.yes),
    literal: Boolean(raw.literal),
  };
}

export function printHelp(): void {
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

export function printVersion(): void {
  console.log(VERSION);
}
