import type { SourceDefinition } from "../core/registry";
import { parseIsoTimestamp } from "../utils/iso-time";
import { baseOf, errorOf, readRaw, toEpoch } from "./value-reader";

/**
 * Any entity whose state or attribute is a point in time: sensors with
 * device_class: timestamp, input_datetime, calendar-like attributes.
 *
 * A timestamp says when something ends, not when it started, so there is no
 * progress unless progress.start or progress.window supplies the other end.
 * Without one the card shows the countdown on a full ring rather than
 * inventing a start -- last_changed would be the obvious guess, and it resets
 * on every Home Assistant restart.
 */
export const timestampSource: SourceDefinition = {
  type: "timestamp",

  detect(entity) {
    const deviceClass = entity.attributes?.device_class;
    if (deviceClass === "timestamp" || deviceClass === "date") return 90;
    if (entity.entity_id.startsWith("input_datetime.")) return 90;
    // Anything else only if the state really is a date-time; a bare number
    // must never be mistaken for one.
    if (
      /^\d{4}-\d{2}-\d{2}/.test(entity.state) &&
      parseIsoTimestamp(entity.state, "UTC")
    ) {
      return 50;
    }
    return null;
  },

  read(ctx) {
    const raw = readRaw(ctx);
    if (raw === undefined || raw === null || raw === "") {
      return errorOf(ctx, "timestamp", "unknown_state");
    }
    const endMs = toEpoch(raw, ctx);
    if (endMs === undefined) {
      return errorOf(ctx, "timestamp", "invalid_timestamp", String(raw));
    }
    return {
      ...baseOf(ctx, "timestamp"),
      unit: undefined,
      kind: "countdown",
      status: "active",
      endMs,
    };
  },
};
