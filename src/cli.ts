#!/usr/bin/env node

/**
 * rnm – interactive batch file renamer CLI
 * Supports --help, --version, --dry-run, and script mode (--dir, --find, --replace, --yes, --literal).
 */

import { runInteractive } from "./commands/interactive.js";
import { runScriptMode } from "./commands/script.js";
import { parseArgs, printHelp, printVersion } from "./flags.js";

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
