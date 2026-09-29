import "../src/sources";
import { normalizeConfig } from "../src/core/config";
import { evaluate, type EngineEnv } from "../src/core/engine";
import { readSnapshot } from "../src/core/pipeline";
import type { RenderedTemplate } from "../src/core/registry";
import type {
  CardConfig,
  HassEntity,
  HomeAssistant,
  UserCardConfig,
} from "../src/types";
import { translator } from "../src/utils/localize";

/** 2026-09-29 20:00:00 UTC, 22:00 in Berlin. */
export const NOW = Date.UTC(2026, 8, 29, 20, 0, 0);

export function entity(
  entity_id: string,
  state: string,
  attributes: Record<string, unknown> = {},
  last_changed = new Date(NOW - 60_000).toISOString(),
): HassEntity {
  return {
    entity_id,
    state,
    attributes,
    last_changed,
    last_updated: last_changed,
    context: { id: "x", parent_id: null, user_id: null },
  } as HassEntity;
}

export function hass(
  entities: HassEntity[],
  extra: Partial<HomeAssistant> = {},
): HomeAssistant {
  return {
    states: Object.fromEntries(entities.map((e) => [e.entity_id, e])),
    connection: {} as HomeAssistant["connection"],
    locale: { language: "en", time_zone: "server" },
    config: { time_zone: "Europe/Berlin" },
    themes: { darkMode: false },
    language: "en",
    ...extra,
  };
}

export function config(extra: Partial<UserCardConfig> = {}): CardConfig {
  return normalizeConfig({ type: "custom:advanced-countdown-card", ...extra });
}

export function env(language = "en", displayZone = "Europe/Berlin"): EngineEnv {
  return { t: translator(language), locale: language, displayZone, hour12: false };
}

/** entity + config + now -> view model, the whole pipeline. */
export function view(
  ent: HassEntity | undefined,
  cfg: Partial<UserCardConfig>,
  now = NOW,
  rendered?: RenderedTemplate,
  others: HassEntity[] = [],
) {
  const c = config({ entity: ent?.entity_id ?? cfg.entity, ...cfg });
  const h = hass(ent ? [ent, ...others] : others);
  const snapshot = readSnapshot(h, c, now, rendered);
  return { snapshot, vm: evaluate(snapshot, c, now, { ...env(), entity: ent }) };
}
