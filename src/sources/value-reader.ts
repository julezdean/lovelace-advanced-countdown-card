import type { SourceContext } from "../core/registry";
import type { ErrorSnapshot, HassEntity, Snapshot } from "../types";
import { nextTimeOfDay, parseIsoTimestamp } from "../utils/iso-time";

/**
 * The shared first step of every entity source: which value to read (state or
 * one attribute), and what `source.map` turns it into. Kept in one place so
 * every source reads the same way.
 */

export function entityName(entity: HassEntity | undefined): string | undefined {
  if (!entity) return undefined;
  const name = entity.attributes?.friendly_name;
  return typeof name === "string" && name ? name : entity.entity_id;
}

export function baseOf(ctx: SourceContext, source: string) {
  return {
    source,
    entityId: ctx.entity?.entity_id,
    name: entityName(ctx.entity),
    unit:
      typeof ctx.entity?.attributes?.unit_of_measurement === "string"
        ? (ctx.entity.attributes.unit_of_measurement as string)
        : undefined,
  };
}

export function errorOf(
  ctx: SourceContext,
  source: string,
  reason: ErrorSnapshot["reason"],
  detail?: string,
): ErrorSnapshot {
  return { ...baseOf(ctx, source), kind: "error", reason, detail };
}

/** The configured raw value, after `source.map`. */
export function readRaw(ctx: SourceContext): unknown {
  const { entity, config } = ctx;
  if (!entity) return undefined;
  const attribute = config.source.attribute;
  const raw = attribute ? entity.attributes?.[attribute] : entity.state;
  const map = config.source.map;
  if (map && (typeof raw === "string" || typeof raw === "number")) {
    const key = String(raw);
    if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
  }
  return raw;
}

/**
 * A whole number or nothing. parseFloat reads a prefix, so a timestamp state
 * like "2026-09-29T14:16:25+00:00" would come out as 2026 -- a proportion has
 * to be a value, not the first digits of something else. A trailing "%" is
 * accepted because template sensors write it; a decimal comma is not, because
 * "1,234" is ambiguous and Home Assistant states always use a point.
 */
export function strictNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const match = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*%?\s*$/i.exec(
    value,
  );
  return match ? Number(match[1]) : undefined;
}

const EPOCH_MS_THRESHOLD = 100_000_000_000; // 1973 in ms, 5138 in seconds

/**
 * A raw value -> epoch ms. Accepts ISO strings (with or without offset), a
 * bare time of day ("22:30", the next occurrence), and epoch numbers in either
 * seconds or milliseconds.
 */
export function toEpoch(value: unknown, ctx: SourceContext): number | undefined {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return undefined;
    return value < EPOCH_MS_THRESHOLD ? value * 1000 : value;
  }
  if (value instanceof Date) return value.getTime();
  return (
    parseIsoTimestamp(value, ctx.naiveZone) ??
    nextTimeOfDay(value, ctx.now, ctx.naiveZone)
  );
}

/** Looks at a raw value and decides whether it is a point in time or a number. */
export function interpretValue(
  value: unknown,
  ctx: SourceContext,
  source: string,
  range: { min: number; max: number },
): Snapshot {
  const base = baseOf(ctx, source);
  const number = strictNumber(value);
  if (number !== undefined) {
    return { ...base, kind: "value", value: number, ...range };
  }
  const epoch = typeof value === "string" ? toEpoch(value, ctx) : undefined;
  if (epoch !== undefined) {
    return { ...base, kind: "countdown", status: "active", endMs: epoch };
  }
  if (value === undefined || value === null || value === "") {
    return errorOf(ctx, source, "unknown_state");
  }
  return errorOf(ctx, source, "undetectable", String(value));
}

/** Min/max for a value: the config first, then what the entity itself declares. */
export function rangeOf(
  ctx: SourceContext,
  percentage: boolean,
): { min: number; max: number } {
  const { progress } = ctx.config;
  const attrs = ctx.entity?.attributes ?? {};
  const fromEntity = (keys: string[]): number | undefined => {
    for (const key of keys) {
      const value = strictNumber(attrs[key]);
      if (value !== undefined) return value;
    }
    return undefined;
  };
  const min =
    progress.min ?? (percentage ? undefined : fromEntity(["min", "minimum"])) ?? 0;
  const max =
    progress.max ??
    (percentage ? undefined : fromEntity(["max", "maximum"])) ??
    100;
  // A counter without a maximum reports none; an inverted range from the
  // entity is not the user's fault and falls back rather than throwing.
  return max > min ? { min, max } : { min: 0, max: 100 };
}
