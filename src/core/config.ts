import type {
  ActionConfig,
  CardConfig,
  DisplayType,
  FormatStyle,
  SourceType,
  Threshold,
  UserCardConfig,
} from "../types";
import { parseSpan } from "../utils/duration";

export class ConfigError extends Error {}

type Section = Record<string, unknown>;

/**
 * Every default in one place. Colours are absent on purpose: undefined means
 * "follow the Home Assistant theme", which is not the same as any concrete
 * colour.
 */
export const DEFAULTS = {
  source: { type: "auto", naive_timezone: "server" },
  progress: { direction: "remaining" },
  display: {
    type: "circle",
    inner: "value",
    style: "ring",
    thickness: 8,
    rounded: true,
    track: true,
    gradient: false,
    orientation: "horizontal",
    segments: 12,
    arc: 270,
    size: "medium",
  },
  format: {
    style: "auto",
    largest_units: 2,
    show_days: "auto",
    show_hours: "auto",
    show_minutes: "auto",
    show_seconds: "auto",
    decimals: 0,
  },
  colors: { mode: "static", basis: "progress", thresholds: [] as Threshold[] },
  animation: {
    enabled: true,
    progress: "smooth",
    effect: "none",
    effect_when: "active",
    finishing_seconds: 60,
    digits: "none",
    speed: "normal",
  },
  on_complete: { action: "show_zero" },
  status: { show: "auto" },
  icon: { icon: "auto", position: "left", size: 1, color: "auto" },
  text: { title: "auto", subtitle: "auto", value: "auto", percentage: false },
  layout: { orientation: "vertical", density: "normal", align: "center" },
  appearance: { glass: false },
} as const;

/** The per-shape defaults that differ from the generic ones. */
const THICKNESS: Record<string, number> = {
  ring: 8,
  donut: 16,
  default: 10,
  thin: 4,
};

const SOURCE_TYPES: SourceType[] = [
  "auto",
  "timer",
  "timestamp",
  "numeric",
  "percentage",
  "template",
  "state",
  "attribute",
];
const DISPLAY_TYPES: DisplayType[] = [
  "circle",
  "radial",
  "bar",
  "segments",
  "digital",
  "numeric",
];
const FORMAT_STYLES: FormatStyle[] = [
  "auto",
  "SS",
  "MM:SS",
  "HH:MM:SS",
  "DD:HH:MM:SS",
  "short",
  "long",
];

/**
 * YAML shorthands -> their long form. Kept separate from the defaults because
 * the editor needs exactly this step and nothing more: it must show the
 * long form, but must not write every default back into the config.
 */
export function expandShorthands(config: UserCardConfig): Record<string, unknown> {
  const out: Record<string, unknown> = { ...config };
  const wrap = (key: string, field: string) => {
    const value = out[key];
    if (value !== undefined && value !== null && typeof value !== "object") {
      out[key] = { [field]: value };
    }
  };
  wrap("source", "type");
  wrap("display", "type");
  wrap("format", "style");
  wrap("on_complete", "action");
  wrap("layout", "orientation");
  wrap("status", "show");
  wrap("animation", "enabled");
  // `icon: false` hides it; `icon: mdi:coffee` names it.
  if (out.icon === false || typeof out.icon === "string")
    out.icon = { icon: out.icon };
  return out;
}

function section(value: unknown, key: string): Section {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ConfigError(`"${key}" must be a mapping.`);
  }
  return value as Section;
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  key: string,
): T {
  if (!allowed.includes(value as T)) {
    throw new ConfigError(
      `"${key}" must be one of ${allowed.join(", ")} -- got "${String(value)}".`,
    );
  }
  return value as T;
}

/** "auto" | true | false, also from the strings the editor's select writes. */
function tristate(value: unknown, key: string): "auto" | boolean {
  if (value === "auto" || value === true || value === false) return value;
  if (value === "true" || value === "show") return true;
  if (value === "false" || value === "hide") return false;
  throw new ConfigError(`"${key}" must be auto, true or false.`);
}

function finite(value: unknown, key: string, min?: number, max?: number): number {
  const num = typeof value === "string" ? Number(value) : value;
  if (typeof num !== "number" || !Number.isFinite(num)) {
    throw new ConfigError(`"${key}" must be a number.`);
  }
  if (min !== undefined && num < min) return min;
  if (max !== undefined && num > max) return max;
  return num;
}

function textSlot(value: unknown, key: string): string | false {
  if (value === false || value === "auto") return value;
  if (value === true) return "auto";
  if (typeof value === "string" || typeof value === "number") return String(value);
  throw new ConfigError(`"${key}" must be auto, false or a text.`);
}

function action(value: unknown, key: string, fallback: ActionConfig): ActionConfig {
  if (value === undefined || value === null) return fallback;
  if (
    typeof value !== "object" ||
    typeof (value as ActionConfig).action !== "string"
  ) {
    throw new ConfigError(`"${key}" needs an "action".`);
  }
  return value as ActionConfig;
}

function thresholds(value: unknown): Threshold[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value))
    throw new ConfigError(`"colors.thresholds" must be a list.`);
  return value.map((entry, i) => {
    if (!entry || typeof entry !== "object") {
      throw new ConfigError(`"colors.thresholds[${i}]" must have value and color.`);
    }
    const { value: v, color } = entry as Record<string, unknown>;
    if (typeof color !== "string" || !color) {
      throw new ConfigError(`"colors.thresholds[${i}].color" is missing.`);
    }
    return { value: finite(v, `colors.thresholds[${i}].value`), color };
  });
}

/**
 * Throws ConfigError for a config the user has to fix -- Lovelace shows its
 * error card for a throwing setConfig, which is the right place for that. Data
 * problems (a missing entity, a bad timestamp) are NOT config errors: those
 * appear later and the card renders them itself.
 */
export function normalizeConfig(input: UserCardConfig): CardConfig {
  if (!input || typeof input !== "object")
    throw new ConfigError("Invalid configuration.");
  const raw = expandShorthands(input);

  const entity = raw.entity;
  if (
    entity !== undefined &&
    (typeof entity !== "string" || !entity.includes("."))
  ) {
    throw new ConfigError(`"entity" must be an entity id such as timer.coffee.`);
  }

  /* source -------------------------------------------------------------- */
  const src: Section = { ...DEFAULTS.source, ...section(raw.source, "source") };
  const sourceType = oneOf(src.type, SOURCE_TYPES, "source.type");
  if (sourceType === "template") {
    if (typeof src.template !== "string" || !src.template.trim()) {
      throw new ConfigError(`source.type: template needs "source.template".`);
    }
  } else if (!entity) {
    throw new ConfigError(`"entity" is required unless source.type is template.`);
  }
  if (sourceType === "attribute" && !src.attribute) {
    throw new ConfigError(`source.type: attribute needs "source.attribute".`);
  }
  if (
    src.map !== undefined &&
    (typeof src.map !== "object" || Array.isArray(src.map))
  ) {
    throw new ConfigError(`"source.map" must be a mapping of state to value.`);
  }

  /* progress ------------------------------------------------------------ */
  const prog: Section = {
    ...DEFAULTS.progress,
    ...section(raw.progress, "progress"),
  };
  oneOf(prog.direction, ["remaining", "elapsed"], "progress.direction");
  if (prog.window !== undefined && parseSpan(prog.window) === undefined) {
    throw new ConfigError(
      `"progress.window" must be a span such as 24h, 90m or 1d 2h.`,
    );
  }
  for (const key of ["min", "max"] as const) {
    if (prog[key] !== undefined) prog[key] = finite(prog[key], `progress.${key}`);
  }
  if (
    prog.min !== undefined &&
    prog.max !== undefined &&
    Number(prog.min) >= Number(prog.max)
  ) {
    throw new ConfigError(`"progress.min" must be below "progress.max".`);
  }

  /* display ------------------------------------------------------------- */
  const disp = section(raw.display, "display");
  const displayType = oneOf(
    disp.type ?? DEFAULTS.display.type,
    DISPLAY_TYPES,
    "display.type",
  );
  const barLike = displayType === "bar" || displayType === "segments";
  const style = oneOf(
    disp.style ?? (barLike ? "default" : "ring"),
    ["ring", "donut", "default", "thin"],
    "display.style",
  );
  const display = {
    ...DEFAULTS.display,
    ...disp,
    type: displayType,
    style,
    inner: oneOf(
      disp.inner ?? "value",
      ["value", "percentage", "icon", "none"],
      "display.inner",
    ),
    thickness: finite(
      disp.thickness ?? THICKNESS[style],
      "display.thickness",
      1,
      40,
    ),
    segments: Math.round(finite(disp.segments ?? 12, "display.segments", 2, 60)),
    arc: finite(disp.arc ?? 270, "display.arc", 90, 340),
    orientation: oneOf(
      disp.orientation ?? "horizontal",
      ["horizontal", "vertical"],
      "display.orientation",
    ),
    size: oneOf(
      disp.size ?? "medium",
      ["small", "medium", "large"],
      "display.size",
    ),
    rounded: disp.rounded !== false,
    track: disp.track !== false,
    gradient: disp.gradient === true,
  };

  /* format -------------------------------------------------------------- */
  const fmt: Section = { ...DEFAULTS.format, ...section(raw.format, "format") };
  const format = {
    style: oneOf(fmt.style, FORMAT_STYLES, "format.style"),
    largest_units: Math.round(
      finite(fmt.largest_units, "format.largest_units", 1, 4),
    ),
    show_days: tristate(fmt.show_days, "format.show_days"),
    show_hours: tristate(fmt.show_hours, "format.show_hours"),
    show_minutes: tristate(fmt.show_minutes, "format.show_minutes"),
    show_seconds: tristate(fmt.show_seconds, "format.show_seconds"),
    decimals: Math.round(finite(fmt.decimals, "format.decimals", 0, 3)),
  };

  /* colors -------------------------------------------------------------- */
  const col: Section = { ...DEFAULTS.colors, ...section(raw.colors, "colors") };
  const colors = {
    ...col,
    mode: oneOf(col.mode, ["static", "thresholds", "gradient"], "colors.mode"),
    basis: oneOf(
      col.basis,
      ["progress", "remaining_seconds", "value"],
      "colors.basis",
    ),
    thresholds: thresholds(col.thresholds),
  };
  if (colors.mode === "thresholds" && !colors.thresholds.length) {
    throw new ConfigError(`colors.mode: thresholds needs "colors.thresholds".`);
  }

  /* animation ----------------------------------------------------------- */
  const anim: Section = {
    ...DEFAULTS.animation,
    ...section(raw.animation, "animation"),
  };
  const effects = ["none", "pulse", "glow", "breathing", "rotate"] as const;
  const animation = {
    enabled: anim.enabled !== false,
    progress: oneOf(
      anim.progress,
      ["smooth", "tick", "none"],
      "animation.progress",
    ),
    effect: oneOf(anim.effect, effects, "animation.effect"),
    effect_when: oneOf(
      anim.effect_when,
      ["always", "active", "finishing", "finished"],
      "animation.effect_when",
    ),
    finishing_seconds: finite(
      anim.finishing_seconds,
      "animation.finishing_seconds",
      1,
    ),
    digits: oneOf(anim.digits, ["none", "flip", "fade"], "animation.digits"),
    speed: oneOf(anim.speed, ["slow", "normal", "fast"], "animation.speed"),
  };

  /* on_complete --------------------------------------------------------- */
  const done: Section = {
    ...DEFAULTS.on_complete,
    ...section(raw.on_complete, "on_complete"),
  };
  const onComplete = {
    ...done,
    action: oneOf(
      done.action,
      ["show_zero", "show_text", "hide", "count_up"],
      "on_complete.action",
    ),
    effect:
      done.effect === undefined
        ? undefined
        : oneOf(done.effect, effects, "on_complete.effect"),
  };

  /* status, icon, text, layout, appearance ------------------------------ */
  const stat: Section = { ...DEFAULTS.status, ...section(raw.status, "status") };
  const status = { ...stat, show: tristate(stat.show, "status.show") };

  const ic: Section = { ...DEFAULTS.icon, ...section(raw.icon, "icon") };
  const icon = {
    icon:
      ic.icon === false || ic.icon === "none" ? (false as const) : String(ic.icon),
    position: oneOf(ic.position, ["left", "top", "inner"], "icon.position"),
    size: finite(ic.size, "icon.size", 0.5, 4),
    color: String(ic.color),
  };

  const tx: Section = { ...DEFAULTS.text, ...section(raw.text, "text") };
  const text = {
    title: textSlot(tx.title, "text.title"),
    subtitle: textSlot(tx.subtitle, "text.subtitle"),
    value: textSlot(tx.value, "text.value"),
    percentage: textSlot(tx.percentage, "text.percentage"),
  };

  const lay: Section = { ...DEFAULTS.layout, ...section(raw.layout, "layout") };
  const layout = {
    orientation: oneOf(
      lay.orientation,
      ["vertical", "horizontal"],
      "layout.orientation",
    ),
    density: oneOf(lay.density, ["normal", "compact", "minimal"], "layout.density"),
    align: oneOf(lay.align, ["start", "center"], "layout.align"),
  };

  const app: Section = {
    ...DEFAULTS.appearance,
    ...section(raw.appearance, "appearance"),
  };
  const appearance = { ...app, glass: app.glass === true };

  return {
    type: String(raw.type ?? ""),
    entity: entity as string | undefined,
    source: { ...src, type: sourceType } as CardConfig["source"],
    progress: prog as CardConfig["progress"],
    display: display as CardConfig["display"],
    format,
    colors: colors as CardConfig["colors"],
    animation,
    on_complete: onComplete as CardConfig["on_complete"],
    status: status as CardConfig["status"],
    icon,
    text,
    layout,
    appearance: appearance as CardConfig["appearance"],
    tap_action: action(raw.tap_action, "tap_action", { action: "more-info" }),
    hold_action: action(raw.hold_action, "hold_action", { action: "none" }),
    double_tap_action: action(raw.double_tap_action, "double_tap_action", {
      action: "none",
    }),
    debug: raw.debug === true,
  };
}
