import type { SourceContext, SourceDefinition } from "../core/registry";
import type { Snapshot } from "../types";
import { parseHmsDuration } from "../utils/duration";
import {
  baseOf,
  errorOf,
  interpretValue,
  rangeOf,
  strictNumber,
  toEpoch,
} from "./value-reader";

/**
 * `source.type: template`: Home Assistant renders a Jinja template and pushes
 * the result whenever an entity it reads changes. The subscription itself
 * lives in card/template-controller.ts; this file only interprets what came
 * back, so it stays a pure function like every other source.
 *
 * Home Assistant turns a rendered result into a native type where it can, so
 * the value arrives as one of:
 *   - a number                       -> a value on progress.min..max
 *   - a string                       -> a timestamp, or a number
 *   - a mapping with any of
 *       end, start, value, min, max, status, name, duration
 *                                    -> whatever it says, for templates that
 *                                       need to supply more than one number
 */

const STATUSES = new Set(["active", "paused", "idle", "finished"]);

function fromMapping(obj: Record<string, unknown>, ctx: SourceContext): Snapshot {
  const base = { ...baseOf(ctx, "template"), unit: undefined };
  const name = typeof obj.name === "string" ? obj.name : base.name;
  const value = strictNumber(obj.value);
  if (value !== undefined) {
    const range = rangeOf(ctx, false);
    return {
      ...base,
      name,
      kind: "value",
      value,
      min: strictNumber(obj.min) ?? range.min,
      max: strictNumber(obj.max) ?? range.max,
    };
  }
  const endMs = toEpoch(obj.end, ctx);
  const startMs = toEpoch(obj.start, ctx);
  const durationMs =
    typeof obj.duration === "number"
      ? obj.duration * 1000
      : parseHmsDuration(obj.duration);
  const status = STATUSES.has(String(obj.status)) ? String(obj.status) : "active";
  if (endMs === undefined && status === "active") {
    return errorOf(ctx, "template", "invalid_timestamp", JSON.stringify(obj.end));
  }
  return {
    ...base,
    name,
    kind: "countdown",
    status: status as "active" | "paused" | "idle" | "finished",
    endMs,
    startMs:
      startMs ??
      (endMs !== undefined && durationMs ? endMs - durationMs : undefined),
    totalMs: durationMs,
    frozenRemainingMs:
      status === "active"
        ? undefined
        : (parseHmsDuration(obj.remaining) ?? durationMs),
  };
}

export const templateSource: SourceDefinition = {
  type: "template",
  read(ctx) {
    const rendered = ctx.rendered;
    if (!rendered || rendered.status === "loading") {
      return errorOf(ctx, "template", "template_loading");
    }
    if (rendered.status === "error") {
      return errorOf(ctx, "template", "template_error", rendered.error);
    }
    const value = rendered.value;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return fromMapping(value as Record<string, unknown>, ctx);
    }
    const snapshot = interpretValue(
      typeof value === "string" ? value.trim() : value,
      ctx,
      "template",
      rangeOf(ctx, false),
    );
    // The template, not the entity, produced this value; the entity's unit
    // would be a guess.
    return snapshot.kind === "value" ? snapshot : { ...snapshot, unit: undefined };
  },
};
