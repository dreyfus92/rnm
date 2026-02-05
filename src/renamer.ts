/**
 * Pure renamer logic: list files, compute new names (find/replace), validate, apply with safe ordering.
 */

import { readdirSync, lstatSync, renameSync } from "node:fs";
import { join } from "node:path";

/** One rename operation: original filename → new filename */
export interface RenameEntry {
  readonly oldName: string;
  readonly newName: string;
}

/** Escape special regex characters so the string can be used as a literal in a regex. */
function escapeRegexLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function listFiles(dir: string): string[] {
  const names = readdirSync(dir);
  const files: string[] = [];
  for (const name of names) {
    try {
      if (lstatSync(join(dir, name)).isFile()) files.push(name);
    } catch {
      // Skip entries we can't stat (e.g. permission denied)
    }
  }
  return files;
}

export function computeNewNames(
  files: string[],
  find: string,
  replace: string,
  isRegex: boolean
): RenameEntry[] {
  let regex: RegExp;
  if (isRegex) {
    try {
      regex = new RegExp(find);
    } catch {
      throw new Error(`Invalid regex: ${find}`);
    }
  } else {
    if (find === "") throw new Error("Find pattern cannot be empty for literal match.");
    regex = new RegExp(escapeRegexLiteral(find), "g");
  }

  const fileSet = new Set(files);
  const renames: RenameEntry[] = [];
  const newNamesSeen = new Set<string>();

  for (const oldName of files) {
    const newName = oldName.replace(regex, replace);

    if (newName === "") {
      throw new Error(`Replacement would produce an empty filename for: ${oldName}`);
    }
    if (newNamesSeen.has(newName)) {
      throw new Error(`Duplicate target name: ${newName}`);
    }
    if (newName !== oldName && fileSet.has(newName)) {
      throw new Error(
        `Replacement would overwrite existing file "${newName}" which is not being renamed.`
      );
    }

    newNamesSeen.add(newName);
    if (newName !== oldName) {
      renames.push({ oldName, newName });
    }
  }

  return renames;
}

export function applyRenames(dir: string, renames: readonly RenameEntry[]): void {
  if (renames.length === 0) return;

  const targets = new Set(renames.map((r) => r.newName));
  const moved = new Map<string, string>();

  for (let i = 0; i < renames.length; i++) {
    const { oldName } = renames[i];
    if (targets.has(oldName)) {
      const tempName = `__rnm_${i}_${oldName}`;
      renameSync(join(dir, oldName), join(dir, tempName));
      moved.set(oldName, tempName);
    }
  }

  for (const { oldName, newName } of renames) {
    const from = moved.get(oldName) ?? oldName;
    renameSync(join(dir, from), join(dir, newName));
  }
}
