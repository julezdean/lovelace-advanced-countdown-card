import type { SourceContext, SourceDefinition } from "../core/registry";
import type { Snapshot } from "../types";
import { baseOf, errorOf, rangeOf, readRaw, strictNumber } from "./value-reader";

/**
 * A number on a scale. `percentage` is the same thing fixed to 0..100 unless
 * progress.min/max say otherwise; `numeric` also takes the range an entity
 * declares itself (input_number, number: min/max; counter: minimum/maximum).
 *
 * A value outside the range is clamped for the drawing but shown as it is in
 * the text: a battery that reports 104 % should look full and still say 104.
 */

const PERCENT_CLASSES = new Set(["battery", "humidity", "moisture"]);

function readNumber(
  ctx: SourceContext,
  type: string,
  percentage: boolean,
): Snapshot {
  const raw = readRaw(ctx);
  if (raw === undefined || raw === null || raw === "") {
    return errorOf(ctx, type, "unknown_state");
  }
  const value = strictNumber(raw);
  if (value === undefined) return errorOf(ctx, type, "invalid_number", String(raw));
  const base = baseOf(ctx, type);
  return {
    ...base,
    unit: base.unit ?? (percentage ? "%" : undefined),
    kind: "value",
    value,
    ...rangeOf(ctx, percentage),
  };
}

export const percentageSource: SourceDefinition = {
  type: "percentage",
  detect(entity) {
    const attrs = entity.attributes ?? {};
    const looksPercent =
      attrs.unit_of_measurement === "%" ||
      PERCENT_CLASSES.has(String(attrs.device_class ?? "")) ||
      /%\s*$/.test(entity.state);
    return looksPercent && strictNumber(entity.state) !== undefined ? 80 : null;
  },
  read: (ctx) => readNumber(ctx, "percentage", true),
};

export const numericSource: SourceDefinition = {
  type: "numeric",
  detect: (entity) => (strictNumber(entity.state) !== undefined ? 40 : null),
  read: (ctx) => readNumber(ctx, "numeric", false),
};
