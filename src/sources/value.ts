import type { SourceDefinition } from "../core/registry";
import { interpretValue, rangeOf, readRaw } from "./value-reader";

/**
 * `source.type: state` and `source.type: attribute`: read that one value and
 * decide from the value itself whether it is a point in time or a number.
 * Useful for attributes of entities that are neither, such as `finishes_at`
 * on something that is not a timer, or `battery_level` on a vacuum.
 */
function valueSource(type: "state" | "attribute"): SourceDefinition {
  return {
    type,
    read: (ctx) => interpretValue(readRaw(ctx), ctx, type, rangeOf(ctx, false)),
  };
}

export const stateSource = valueSource("state");
export const attributeSource = valueSource("attribute");
