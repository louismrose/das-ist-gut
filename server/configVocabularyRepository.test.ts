import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ConfigVocabularyRepository, parseVocabularyConfig } from "./configVocabularyRepository";

const config = {
  sets: [
    {
      id: "animals",
      name: "Animals",
      items: [
        { english: "dog", german: "der Hund" },
        { english: "cat", german: "die Katze" },
      ],
    },
    {
      id: "colours",
      name: "Colours",
      items: [{ english: "red", german: "rot" }],
    },
  ],
};

describe("ConfigVocabularyRepository", () => {
  let repository: ConfigVocabularyRepository;

  beforeAll(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "vocab-"));
    const filePath = path.join(dir, "vocabulary.json");
    await writeFile(filePath, JSON.stringify(config));
    repository = new ConfigVocabularyRepository(filePath);
  });

  it("lists set summaries with item counts", async () => {
    expect(await repository.getSets()).toEqual([
      { id: "animals", name: "Animals", itemCount: 2 },
      { id: "colours", name: "Colours", itemCount: 1 },
    ]);
  });

  it("returns a full set by id", async () => {
    const set = await repository.getSet("animals");
    expect(set?.name).toBe("Animals");
    expect(set?.items).toHaveLength(2);
    expect(set?.items[0]).toEqual({ english: "dog", german: "der Hund" });
  });

  it("returns null for an unknown id", async () => {
    expect(await repository.getSet("nope")).toBeNull();
  });
});

describe("parseVocabularyConfig", () => {
  it("rejects invalid JSON", () => {
    expect(() => parseVocabularyConfig("not json", "test")).toThrow(/not valid JSON/);
  });

  it("rejects a missing sets array", () => {
    expect(() => parseVocabularyConfig("{}", "test")).toThrow(/"sets" array/);
  });

  it("rejects a set without an id", () => {
    const raw = JSON.stringify({ sets: [{ name: "X", items: [] }] });
    expect(() => parseVocabularyConfig(raw, "test")).toThrow(/string "id" and "name"/);
  });

  it("rejects duplicate set ids", () => {
    const raw = JSON.stringify({
      sets: [
        { id: "a", name: "A", items: [{ english: "x", german: "y" }] },
        { id: "a", name: "B", items: [{ english: "x", german: "y" }] },
      ],
    });
    expect(() => parseVocabularyConfig(raw, "test")).toThrow(/duplicate set id/);
  });

  it("rejects an empty items array", () => {
    const raw = JSON.stringify({ sets: [{ id: "a", name: "A", items: [] }] });
    expect(() => parseVocabularyConfig(raw, "test")).toThrow(/non-empty "items"/);
  });

  it("rejects items with missing translations", () => {
    const raw = JSON.stringify({ sets: [{ id: "a", name: "A", items: [{ english: "dog" }] }] });
    expect(() => parseVocabularyConfig(raw, "test")).toThrow(/"english" and "german"/);
  });
});
