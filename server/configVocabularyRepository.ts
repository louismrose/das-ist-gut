import { readFile } from "node:fs/promises";
import type { VocabularySet, VocabularySetSummary } from "../shared/types.js";
import type { VocabularyRepository } from "./vocabularyRepository.js";

/**
 * VocabularyRepository backed by a JSON configuration file.
 *
 * The file is read on every request, so vocabulary edits show up without a
 * restart. That is comfortably fast for a home-network app with a small file;
 * a database-backed implementation can replace this class later.
 */
export class ConfigVocabularyRepository implements VocabularyRepository {
  constructor(private readonly filePath: string) {}

  async getSets(): Promise<VocabularySetSummary[]> {
    const sets = await this.load();
    return sets.map((set) => ({ id: set.id, name: set.name, itemCount: set.items.length }));
  }

  async getSet(id: string): Promise<VocabularySet | null> {
    const sets = await this.load();
    return sets.find((set) => set.id === id) ?? null;
  }

  private async load(): Promise<VocabularySet[]> {
    const raw = await readFile(this.filePath, "utf8");
    return parseVocabularyConfig(raw, this.filePath);
  }
}

/** Parses and validates the vocabulary config, throwing a descriptive error if it is malformed. */
export function parseVocabularyConfig(raw: string, source: string): VocabularySet[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${source} is not valid JSON: ${(error as Error).message}`, { cause: error });
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.sets)) {
    throw new Error(`${source} must be an object with a "sets" array`);
  }

  const seenIds = new Set<string>();
  return parsed.sets.map((set, index) => {
    if (!isRecord(set) || !isNonEmptyString(set.id) || !isNonEmptyString(set.name)) {
      throw new Error(`${source}: set at index ${index} must have string "id" and "name"`);
    }
    if (seenIds.has(set.id)) {
      throw new Error(`${source}: duplicate set id "${set.id}"`);
    }
    seenIds.add(set.id);

    if (!Array.isArray(set.items) || set.items.length === 0) {
      throw new Error(`${source}: set "${set.id}" must have a non-empty "items" array`);
    }
    const items = set.items.map((item, itemIndex) => {
      if (!isRecord(item) || !isNonEmptyString(item.english) || !isNonEmptyString(item.german)) {
        throw new Error(
          `${source}: item ${itemIndex} in set "${set.id}" must have string "english" and "german"`,
        );
      }
      return { english: item.english, german: item.german };
    });

    return { id: set.id, name: set.name, items };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
