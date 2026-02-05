import { describe, expect, it } from "vitest";
import { BUILT_IN_PRESETS } from "../patterns-config.js";
import { computeNewNames, countFilesWithMatch } from "../renamer.js";

describe("computeNewNames (regex)", () => {
  it("Remove brackets only: removes both [ and ] (global replace)", () => {
    const files = ["[a].txt", "[b].txt"];
    const preset = BUILT_IN_PRESETS.find((p) => p.name === "Remove brackets only")!;
    const renames = computeNewNames(files, preset.find, preset.replace, true);
    expect(renames).toEqual([
      { oldName: "[a].txt", newName: "a.txt" },
      { oldName: "[b].txt", newName: "b.txt" },
    ]);
  });

  it("Remove parentheses only: removes both ( and ) (global replace)", () => {
    const files = ["(copy).txt", "photo (1).jpg"];
    const preset = BUILT_IN_PRESETS.find((p) => p.name === "Remove parentheses only")!;
    const renames = computeNewNames(files, preset.find, preset.replace, true);
    expect(renames).toEqual([
      { oldName: "(copy).txt", newName: "copy.txt" },
      { oldName: "photo (1).jpg", newName: "photo 1.jpg" },
    ]);
  });

  it("Spaces to underscores: replaces all space runs", () => {
    const files = ["a b c.txt", "  two  spaces  .txt"];
    const preset = BUILT_IN_PRESETS.find((p) => p.name === "Spaces to underscores")!;
    const renames = computeNewNames(files, preset.find, preset.replace, true);
    expect(renames).toEqual([
      { oldName: "a b c.txt", newName: "a_b_c.txt" },
      { oldName: "  two  spaces  .txt", newName: "_two_spaces_.txt" },
    ]);
  });

  it("Remove digits: removes all digit runs", () => {
    const files = ["photo123.jpg", "1a2b3.txt"];
    const preset = BUILT_IN_PRESETS.find((p) => p.name === "Remove digits")!;
    const renames = computeNewNames(files, preset.find, preset.replace, true);
    expect(renames).toEqual([
      { oldName: "photo123.jpg", newName: "photo.jpg" },
      { oldName: "1a2b3.txt", newName: "ab.txt" },
    ]);
  });

  it("Remove leading zeros: only at start when followed by more digits", () => {
    const files = ["0012.jpg", "00.txt", "0x.png"];
    const preset = BUILT_IN_PRESETS.find((p) => p.name === "Remove leading zeros")!;
    const renames = computeNewNames(files, preset.find, preset.replace, true);
    expect(renames).toEqual([
      { oldName: "0012.jpg", newName: "12.jpg" },
      { oldName: "00.txt", newName: "0.txt" }, // first "0" is followed by digit "0", so one zero removed
    ]);
    // 0x.png unchanged (0 not followed by digit) so not in renames
  });
});

describe("computeNewNames (literal)", () => {
  it("replaces literal find with replace (global)", () => {
    const renames = computeNewNames(
      ["photo_1.jpg", "photo_2.jpg"],
      "photo_",
      "img_",
      false,
    );
    expect(renames).toEqual([
      { oldName: "photo_1.jpg", newName: "img_1.jpg" },
      { oldName: "photo_2.jpg", newName: "img_2.jpg" },
    ]);
  });
});

describe("computeNewNames (errors)", () => {
  it("throws on invalid regex", () => {
    expect(() =>
      computeNewNames(["a.txt"], "[invalid", "", true),
    ).toThrow(/Invalid regex/);
  });
});

describe("countFilesWithMatch", () => {
  it("counts files that match the regex (global flag does not break counting)", () => {
    const files = ["[a].txt", "[b].txt", "plain.txt"];
    const preset = BUILT_IN_PRESETS.find((p) => p.name === "Remove brackets only")!;
    const count = countFilesWithMatch(files, preset.find, true);
    expect(count).toBe(2);
  });
});
