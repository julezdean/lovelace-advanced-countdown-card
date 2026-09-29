import type { SourceDefinition } from "../core/registry";
import type { CountdownSnapshot } from "../types";
import { parseHmsDuration } from "../utils/duration";
import { parseIsoTimestamp } from "../utils/iso-time";
import { baseOf, errorOf } from "./value-reader";

/**
 * Home Assistant `timer` entities, as core writes them (timer/__init__.py):
 *
 *   state      attributes present
 *   active     duration, remaining, finishes_at, last_transition
 *   paused     duration, remaining,              last_transition
 *   idle       duration,                         last_transition
 *
 * The timer writes its state only on transitions, never while it runs, so
 * `remaining` on an active timer is the value from when it was started -- the
 * live countdown has to come from `finishes_at`, which is exactly what Home
 * Assistant's own frontend does (timerTimeRemaining in src/data/timer.ts).
 *
 * `last_transition` (since 2026.5) is what tells a finished timer from a
 * cancelled one once both are idle. Without it an idle timer is just idle.
 */
export const timerSource: SourceDefinition = {
  type: "timer",

  detect: (entity) => (entity.entity_id.startsWith("timer.") ? 100 : null),

  read(ctx) {
    const entity = ctx.entity;
    if (!entity) return errorOf(ctx, "timer", "entity_missing");
    const attrs = entity.attributes ?? {};
    const base = { ...baseOf(ctx, "timer"), unit: undefined };
    const totalMs = parseHmsDuration(attrs.duration);
    const remainingMs = parseHmsDuration(attrs.remaining);

    switch (entity.state) {
      case "active": {
        let endMs = parseIsoTimestamp(attrs.finishes_at);
        // An active timer always has finishes_at on current cores. If one does
        // not, remaining counted from the last state write is the next best.
        if (endMs === undefined && remainingMs !== undefined) {
          const changed = parseIsoTimestamp(entity.last_changed);
          if (changed !== undefined) endMs = changed + remainingMs;
        }
        if (endMs === undefined) {
          return errorOf(
            ctx,
            "timer",
            "invalid_timestamp",
            String(attrs.finishes_at),
          );
        }
        const snapshot: CountdownSnapshot = {
          ...base,
          kind: "countdown",
          status: "active",
          endMs,
        };
        if (totalMs !== undefined && totalMs > 0) {
          snapshot.totalMs = totalMs;
          snapshot.startMs = endMs - totalMs;
        }
        return snapshot;
      }

      case "paused":
        return {
          ...base,
          kind: "countdown",
          status: "paused",
          frozenRemainingMs: remainingMs ?? totalMs ?? 0,
          totalMs: totalMs && totalMs > 0 ? totalMs : undefined,
        };

      case "idle": {
        if (attrs.last_transition === "finished") {
          return {
            ...base,
            kind: "countdown",
            status: "finished",
            frozenRemainingMs: 0,
            totalMs: totalMs && totalMs > 0 ? totalMs : undefined,
            // The finishing transition is the last state write.
            finishedAtMs: parseIsoTimestamp(entity.last_changed),
          };
        }
        return {
          ...base,
          kind: "countdown",
          status: "idle",
          frozenRemainingMs: totalMs ?? 0,
          totalMs: totalMs && totalMs > 0 ? totalMs : undefined,
        };
      }

      default:
        return errorOf(ctx, "timer", "undetectable", entity.state);
    }
  },
};
