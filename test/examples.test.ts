/**
 * The example configurations in examples/ are documentation, and
 * documentation that does not parse is worse than none. Every card in every
 * file goes through the same normalizeConfig() the card uses.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { normalizeConfig } from "../src/core/config";
import type { UserCardConfig } from "../src/types";

// Under happy-dom import.meta.url is not a file: URL; vitest runs from the root.
const DIR = resolve(process.cwd(), "examples");
const FILES = readdirSync(DIR).filter((name) => name.endsWith(".yaml"));

function cardsIn(node: Record<string, unknown>): UserCardConfig[] {
  if (node.type === "custom:advanced-countdown-card")
    return [node as unknown as UserCardConfig];
  const children = Array.isArray(node.cards) ? node.cards : [];
  return children.flatMap((child) => cardsIn(child as Record<string, unknown>));
}

describe("examples", () => {
  it("there are examples to check", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(5);
  });

  for (const file of FILES) {
    it(`examples/${file} is valid YAML with valid card configs`, () => {
      const raw = parse(readFileSync(resolve(DIR, file), "utf8"));
      const cards = cardsIn(raw);
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) expect(() => normalizeConfig(card)).not.toThrow();
    });
  }
});
