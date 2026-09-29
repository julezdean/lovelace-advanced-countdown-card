import type {
  CardConfig,
  HassEntity,
  HomeAssistant,
  Snapshot,
  TimeRef,
} from "../types";
import { parseSpan } from "../utils/duration";
import { parseIsoTimestamp } from "../utils/iso-time";
import { errorOf, toEpoch } from "../sources/value-reader";
import {
  detectSource,
  getSource,
  type RenderedTemplate,
  type SourceContext,
} from "./registry";

/**
 * Entity -> Snapshot. Runs only when something the card watches changes, never
 * per tick: a snapshot holds no "now", so it stays valid until the entity
 * changes again.
 */

export function naiveZoneOf(
  hass: HomeAssistant,
  config: CardConfig,
): string | undefined {
  return config.source.naive_timezone === "server"
    ? hass.config?.time_zone
    : undefined;
}

/** Every entity whose change can change what the card shows. */
export function watchedEntities(config: CardConfig): string[] {
  const ids = new Set<string>();
  if (config.entity) ids.add(config.entity);
  for (const ref of [config.progress.start, config.progress.end]) {
    if (ref && typeof ref === "object" && ref.entity) ids.add(ref.entity);
  }
  return [...ids];
}

function resolveTimeRef(
  ref: TimeRef | undefined,
  ctx: SourceContext,
): number | undefined {
  if (ref === undefined || ref === null) return undefined;
  if (ref === "last_changed") return parseIsoTimestamp(ctx.entity?.last_changed);
  if (typeof ref === "string") return toEpoch(ref, ctx);
  const entity: HassEntity | undefined = ctx.hass.states[ref.entity];
  if (!entity) return undefined;
  const raw = ref.attribute ? entity.attributes?.[ref.attribute] : entity.state;
  return toEpoch(raw, ctx);
}

/**
 * progress.start / end / window apply to every countdown source the same way,
 * which is why they live here and not in each source. `end` overrides what the
 * source read; `start` beats `window`, which beats what the source knew.
 */
function applyProgress(snapshot: Snapshot, ctx: SourceContext): Snapshot {
  if (snapshot.kind !== "countdown") return snapshot;
  const { progress } = ctx.config;
  const out = { ...snapshot };

  const end = resolveTimeRef(progress.end, ctx);
  if (end !== undefined && out.status === "active") out.endMs = end;

  const start = resolveTimeRef(progress.start, ctx);
  const window =
    progress.window === undefined ? undefined : parseSpan(progress.window);
  if (start !== undefined) {
    out.startMs = start;
  } else if (window !== undefined && out.endMs !== undefined) {
    out.startMs = out.endMs - window;
  }
  if (out.startMs !== undefined && out.endMs !== undefined) {
    // A start at or after the end cannot carry a proportion.
    out.totalMs = out.endMs > out.startMs ? out.endMs - out.startMs : undefined;
    if (out.totalMs === undefined) out.startMs = undefined;
  }
  return out;
}

export function readSnapshot(
  hass: HomeAssistant,
  config: CardConfig,
  now: number,
  rendered?: RenderedTemplate,
): Snapshot {
  const entity = config.entity ? hass.states[config.entity] : undefined;
  const ctx: SourceContext = {
    hass,
    config,
    entity,
    now,
    naiveZone: naiveZoneOf(hass, config),
    rendered,
  };
  const type = config.source.type;

  if (type !== "template") {
    if (!config.entity) return errorOf(ctx, type, "no_entity");
    if (!entity) return errorOf(ctx, type, "entity_missing", config.entity);
    if (entity.state === "unavailable") return errorOf(ctx, type, "unavailable");
    // An attribute can be perfectly readable while the state is unknown.
    if (entity.state === "unknown" && !config.source.attribute) {
      return errorOf(ctx, type, "unknown_state");
    }
  }

  let definition;
  if (type === "auto") {
    definition = config.source.attribute
      ? getSource("attribute")
      : entity
        ? detectSource(entity)
        : undefined;
    if (!definition) return errorOf(ctx, "auto", "undetectable", entity?.state);
  } else {
    definition = getSource(type);
    if (!definition)
      return errorOf(ctx, type, "undetectable", `no source "${type}"`);
  }

  return applyProgress(definition.read(ctx), ctx);
}
