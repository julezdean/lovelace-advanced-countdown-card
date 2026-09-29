import type { Connection, HassEntity } from "home-assistant-js-websocket";

export type { HassEntity };

/* -------------------------------------------------------------------------- */
/* Home Assistant                                                              */
/* -------------------------------------------------------------------------- */

/** Mirrors frontend/src/data/translation.ts */
export interface FrontendLocaleData {
  language: string;
  number_format?: string;
  time_format?: "language" | "system" | "12" | "24";
  time_zone?: "local" | "server";
}

/**
 * Only the parts of `hass` this card touches. Hand-written on purpose:
 * `custom-card-helpers` is unmaintained and types several of these wrong.
 */
export interface HomeAssistant {
  states: Record<string, HassEntity>;
  connection: Connection;
  locale: FrontendLocaleData;
  config: { time_zone: string };
  themes?: { darkMode?: boolean };
  language: string;
  formatEntityState?: (stateObj: HassEntity, state?: string) => string;
}

export interface LovelaceGridOptions {
  columns?: number | "full";
  rows?: number | "auto";
  min_columns?: number;
  max_columns?: number;
  min_rows?: number;
  max_rows?: number;
}

/**
 * Home Assistant's own action config. The card never interprets it: it hands
 * it to the frontend via the `hass-action` event, so every action Home
 * Assistant knows -- including `confirmation` and `assist` -- works unchanged.
 */
export interface ActionConfig {
  action: string;
  [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* Configuration as written                                                    */
/* -------------------------------------------------------------------------- */

export type SourceType =
  | "auto"
  | "timer"
  | "timestamp"
  | "numeric"
  | "percentage"
  | "template"
  /** Aliases: read the state or one attribute and detect what it holds. */
  | "state"
  | "attribute";

export type DisplayType =
  "circle" | "radial" | "bar" | "segments" | "digital" | "numeric";
export type InnerContent = "value" | "percentage" | "icon" | "none";
export type Direction = "remaining" | "elapsed";
export type Tristate = "auto" | boolean;
/** `auto`, a literal text with {placeholders}, or false to hide the area. */
export type TextSlot = "auto" | false | string;

export type FormatStyle =
  "auto" | "SS" | "MM:SS" | "HH:MM:SS" | "DD:HH:MM:SS" | "short" | "long";

export interface SourceConfig {
  type?: SourceType;
  attribute?: string;
  /** State (or attribute) value -> number or timestamp, before interpretation. */
  map?: Record<string, number | string>;
  template?: string;
  /** How a timestamp without an offset is read. */
  naive_timezone?: "server" | "browser";
}

/** A point in time: an ISO string, an entity (optionally one attribute), or
 *  the source entity's own last_changed. */
export type TimeRef = string | { entity: string; attribute?: string };

export interface ProgressConfig {
  direction?: Direction;
  start?: TimeRef;
  end?: TimeRef;
  /** "24h", "90m", "1d 2h" or seconds. Start = end - window. */
  window?: string | number;
  min?: number;
  max?: number;
}

export interface DisplayConfig {
  type?: DisplayType;
  inner?: InnerContent;
  /** circle: ring | donut. bar: default | thin. */
  style?: "ring" | "donut" | "default" | "thin";
  /** circle/radial: percent of the diameter. bar/segments: px. */
  thickness?: number;
  rounded?: boolean;
  track?: boolean;
  /** Colour runs from primary to secondary along the shape. */
  gradient?: boolean;
  orientation?: "horizontal" | "vertical";
  segments?: number;
  /** radial: opening of the arc in degrees. */
  arc?: number;
  size?: "small" | "medium" | "large";
}

export interface FormatConfig {
  style?: FormatStyle;
  largest_units?: number;
  show_days?: Tristate;
  show_hours?: Tristate;
  show_minutes?: Tristate;
  show_seconds?: Tristate;
  decimals?: number;
}

export interface Threshold {
  value: number;
  color: string;
}

export interface ColorConfig {
  primary?: string;
  secondary?: string;
  track?: string;
  text?: string;
  mode?: "static" | "thresholds" | "gradient";
  basis?: "progress" | "remaining_seconds" | "value";
  thresholds?: Threshold[];
  start?: string;
  end?: string;
}

export type AnimationEffect = "none" | "pulse" | "glow" | "breathing" | "rotate";

export interface AnimationConfig {
  enabled?: boolean;
  progress?: "smooth" | "tick" | "none";
  effect?: AnimationEffect;
  effect_when?: "always" | "active" | "finishing" | "finished";
  finishing_seconds?: number;
  digits?: "none" | "flip" | "fade";
  speed?: "slow" | "normal" | "fast";
}

export interface OnCompleteConfig {
  action?: "show_zero" | "show_text" | "hide" | "count_up";
  text?: string;
  color?: string;
  effect?: AnimationEffect;
}

export type CountdownStatus = "active" | "paused" | "idle" | "finished" | "unknown";

export interface StatusConfig {
  show?: Tristate;
  labels?: Partial<Record<CountdownStatus, string>>;
}

export interface IconConfig {
  icon?: string | false;
  position?: "left" | "top" | "inner";
  /** Relative to the title font size. */
  size?: number;
  /** `auto` follows the progress colour. */
  color?: string;
}

export interface TextConfig {
  title?: TextSlot;
  subtitle?: TextSlot;
  value?: TextSlot;
  percentage?: TextSlot | true;
}

export interface LayoutConfig {
  orientation?: "vertical" | "horizontal";
  density?: "normal" | "compact" | "minimal";
  align?: "start" | "center";
}

export interface AppearanceConfig {
  glass?: boolean;
  background?: string;
}

export interface UserCardConfig {
  type: string;
  entity?: string;
  source?: SourceConfig | SourceType;
  progress?: ProgressConfig;
  display?: DisplayConfig | DisplayType;
  format?: FormatConfig | FormatStyle;
  colors?: ColorConfig;
  animation?: AnimationConfig | boolean;
  on_complete?: OnCompleteConfig | OnCompleteConfig["action"];
  status?: StatusConfig | Tristate;
  icon?: IconConfig | string | false;
  text?: TextConfig;
  layout?: LayoutConfig | LayoutConfig["orientation"];
  appearance?: AppearanceConfig;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  /** Logs source and engine details to the console. */
  debug?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Configuration after normalizeConfig                                         */
/* -------------------------------------------------------------------------- */

/** No shorthands, every default filled in. The rest of the card only ever
 *  sees this shape. */
export interface CardConfig {
  type: string;
  entity?: string;
  source: Required<Pick<SourceConfig, "type" | "naive_timezone">> &
    Pick<SourceConfig, "attribute" | "map" | "template">;
  progress: Required<Pick<ProgressConfig, "direction">> &
    Omit<ProgressConfig, "direction">;
  display: Required<DisplayConfig>;
  format: Required<FormatConfig>;
  colors: Required<Pick<ColorConfig, "mode" | "basis" | "thresholds">> &
    Omit<ColorConfig, "mode" | "basis" | "thresholds">;
  animation: Required<AnimationConfig>;
  on_complete: Required<Pick<OnCompleteConfig, "action">> &
    Omit<OnCompleteConfig, "action">;
  status: Required<Pick<StatusConfig, "show">> & StatusConfig;
  icon: Required<Pick<IconConfig, "icon" | "position" | "size" | "color">>;
  /** `true` has become "auto" here. */
  text: Record<keyof TextConfig, string | false>;
  layout: Required<LayoutConfig>;
  appearance: Required<Pick<AppearanceConfig, "glass">> & AppearanceConfig;
  tap_action: ActionConfig;
  hold_action: ActionConfig;
  double_tap_action: ActionConfig;
  debug: boolean;
}

/* -------------------------------------------------------------------------- */
/* Snapshot: what a source reads, independent of the current time              */
/* -------------------------------------------------------------------------- */

interface SnapshotBase {
  entityId?: string;
  name?: string;
  unit?: string;
  /** Which source produced it, after auto detection. For debugging and a11y. */
  source: string;
}

export interface CountdownSnapshot extends SnapshotBase {
  kind: "countdown";
  /**
   * `active` means "running towards endMs"; whether it has already passed is
   * decided by the engine, because that depends on the current time.
   */
  status: Exclude<CountdownStatus, "unknown">;
  endMs?: number;
  startMs?: number;
  /** Paused: the remaining time frozen at the pause. Idle: the full duration. */
  frozenRemainingMs?: number;
  totalMs?: number;
  /** When a finished countdown ended, for count_up. */
  finishedAtMs?: number;
}

export interface ValueSnapshot extends SnapshotBase {
  kind: "value";
  value: number;
  min: number;
  max: number;
}

export type ErrorReason =
  | "no_entity"
  | "entity_missing"
  | "unavailable"
  | "unknown_state"
  | "invalid_timestamp"
  | "invalid_number"
  | "undetectable"
  | "template_error"
  | "template_loading";

export interface ErrorSnapshot extends SnapshotBase {
  kind: "error";
  reason: ErrorReason;
  /** Shown to the user where it helps (the bad value), logged in debug mode. */
  detail?: string;
}

export type Snapshot = CountdownSnapshot | ValueSnapshot | ErrorSnapshot;

export const isCountdown = (s: Snapshot): s is CountdownSnapshot =>
  s.kind === "countdown";
export const isValue = (s: Snapshot): s is ValueSnapshot => s.kind === "value";
export const isError = (s: Snapshot): s is ErrorSnapshot => s.kind === "error";

/* -------------------------------------------------------------------------- */
/* View model: what the engine derives for one moment                          */
/* -------------------------------------------------------------------------- */

export interface ViewModel {
  kind: Snapshot["kind"];
  status: CountdownStatus;
  /** 0..1, direction already applied. null = not knowable (no start time). */
  progress: number | null;
  /** Negative once a count_up countdown has passed its end. */
  remainingMs?: number;
  value?: number;
  outOfRange: boolean;
  /** Resolved CSS colour for the progress, possibly var(...) or color-mix(). */
  color: string;
  /** Is the effect animation running right now. */
  effect: AnimationConfig["effect"];
  hidden: boolean;
  texts: {
    title?: string;
    subtitle?: string;
    value?: string;
    percentage?: string;
    status?: string;
  };
  /** The value split into digit groups, for the digital renderer. */
  digits?: string[];
  ariaLabel: string;
  error?: ErrorSnapshot;
}
