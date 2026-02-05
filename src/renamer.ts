/**
 * Pure renamer logic: list files, compute new names (find/replace), validate, apply with safe ordering.
 */

/** One rename operation: original filename → new filename */
export interface RenameEntry {
  readonly oldName: string;
  readonly newName: string;
}

export function listFiles(dir: string): string[] {
  // TODO: readdirSync + lstatSync, return file names only (no dirs)
  return [];
}

export function computeNewNames(
  files: string[],
  find: string,
  replace: string,
  isRegex: boolean
): RenameEntry[] {
  // TODO: literal (escape regex) or regex replace; validate no empty/duplicate/overwrite
  return [];
}

export function applyRenames(dir: string, renames: readonly RenameEntry[]): void {
  // TODO: temp names for overlapping renames, then renameSync to final
}
