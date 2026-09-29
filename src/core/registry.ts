import type { TemplateResult } from "lit";
import type {
  CardConfig,
  HassEntity,
  HomeAssistant,
  Snapshot,
  ViewModel,
} from "../types";

/**
 * The two extension points. A new data source or a new visualisation is one
 * file plus one register call; neither the engine nor the card changes.
 *
 *   SourceDefinition.read(ctx)      -> Snapshot   (only when the entity changes)
 *   engine.evaluate(snapshot, now)  -> ViewModel  (per tick, pure)
 *   RendererDefinition.render(...)  -> TemplateResult
 */

/** What a template subscription has delivered so far. */
export interface RenderedTemplate {
  status: "loading" | "ready" | "error";
  value?: unknown;
  error?: string;
}

export interface SourceContext {
  hass: HomeAssistant;
  config: CardConfig;
  entity?: HassEntity;
  /** Only for sources that resolve a time of day into the next occurrence. */
  now: number;
  /** IANA zone for timestamps without an offset; undefined = browser zone. */
  naiveZone?: string;
  rendered?: RenderedTemplate;
}

export interface SourceDefinition {
  type: string;
  /**
   * For source.type: auto. Returns a priority (higher wins) if this source can
   * read the entity, or null. Must be cheap: it runs on every entity change.
   */
  detect?(entity: HassEntity): number | null;
  read(ctx: SourceContext): Snapshot;
}

export interface RenderContext {
  vm: ViewModel;
  config: CardConfig;
  /** Content for the centre of a ring or arc; renderers without one ignore it. */
  inner: TemplateResult | undefined;
  /** Unique per card instance, for SVG ids (gradients). */
  uid: string;
}

export interface RendererDefinition {
  type: string;
  /** Whether the renderer has a centre that can hold the value or an icon. */
  hasInner: boolean;
  render(ctx: RenderContext): TemplateResult;
}

const sources = new Map<string, SourceDefinition>();
const renderers = new Map<string, RendererDefinition>();

export function registerSource(definition: SourceDefinition): void {
  sources.set(definition.type, definition);
}

export function registerRenderer(definition: RendererDefinition): void {
  renderers.set(definition.type, definition);
}

export function getSource(type: string): SourceDefinition | undefined {
  return sources.get(type);
}

export function getRenderer(type: string): RendererDefinition | undefined {
  return renderers.get(type);
}

/** All sources that take part in auto detection, highest priority first. */
export function detectSource(entity: HassEntity): SourceDefinition | undefined {
  let best: SourceDefinition | undefined;
  let bestScore = -Infinity;
  for (const definition of sources.values()) {
    const score = definition.detect?.(entity);
    if (score !== null && score !== undefined && score > bestScore) {
      best = definition;
      bestScore = score;
    }
  }
  return best;
}
