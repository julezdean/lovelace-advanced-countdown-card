import type {
  CardConfig,
  CountdownSnapshot,
  CountdownStatus,
  ErrorSnapshot,
  HassEntity,
  Snapshot,
  ValueSnapshot,
  ViewModel,
} from "../types";
import { progressColor, resolveColor } from "../utils/colors";
import {
  formatClock,
  formatDuration,
  formatNumber,
  formatPercent,
  splitDuration,
  type Unit,
} from "../utils/format";
import { epochToWallTime } from "../utils/iso-time";
import type { Translate } from "../utils/localize";
import { fillPlaceholders } from "../utils/placeholders";

/**
 * Snapshot + now -> ViewModel. Pure: no DOM, no hass, no timers. Everything
 * that depends on the current time is computed here and nowhere else, which
 * is what lets the card tick without touching Home Assistant.
 */

export interface EngineEnv {
  t: Translate;
  locale: string;
  /** Zone for displayed wall-clock times; undefined = browser. */
  displayZone?: string;
  /** From the user's 12/24 h preference; undefined = the locale decides. */
  hour12?: boolean;
  entity?: HassEntity;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const COLON_UNITS: Record<string, Unit[]> = {
  SS: ["s"],
  "MM:SS": ["m", "s"],
  "HH:MM:SS": ["h", "m", "s"],
  "DD:HH:MM:SS": ["d", "h", "m", "s"],
};

/** Digit groups for the digital renderer, always in colon form. */
function digitGroups(
  ms: number,
  format: CardConfig["format"],
  round: "up" | "down",
) {
  let units = COLON_UNITS[format.style];
  if (!units) {
    const abs = Math.abs(ms);
    units =
      abs >= 86_400_000
        ? ["d", "h", "m", "s"]
        : abs >= 3_600_000
          ? ["h", "m", "s"]
          : ["m", "s"];
    if (format.show_seconds === false && units.length > 2)
      units = units.slice(0, -1);
  }
  const values = splitDuration(Math.abs(ms), units, round);
  return units.map((unit) => String(values[unit]).padStart(2, "0"));
}

function sameDay(a: number, b: number, zone?: string): boolean {
  const x = epochToWallTime(a, zone);
  const y = epochToWallTime(b, zone);
  return x.year === y.year && x.month === y.month && x.day === y.day;
}

function textFor(
  slot: string | false,
  auto: string | undefined,
  values: Record<string, string | undefined>,
  entity?: HassEntity,
): string | undefined {
  if (slot === false) return undefined;
  if (slot === "auto") return auto;
  return fillPlaceholders(slot, values, entity);
}

function effectFor(
  config: CardConfig,
  status: CountdownStatus,
  remainingMs: number | undefined,
): ViewModel["effect"] {
  const { animation, on_complete } = config;
  if (!animation.enabled) return "none";
  if (status === "finished" && on_complete.effect) return on_complete.effect;
  const effect = animation.effect;
  if (effect === "none") return "none";
  switch (animation.effect_when) {
    case "always":
      return effect;
    case "active":
      return status === "active" ? effect : "none";
    case "finished":
      return status === "finished" ? effect : "none";
    case "finishing":
      return status === "active" &&
        remainingMs !== undefined &&
        remainingMs <= animation.finishing_seconds * 1000
        ? effect
        : "none";
  }
  return "none";
}

function statusText(
  config: CardConfig,
  status: CountdownStatus,
  t: Translate,
): string {
  return config.status.labels?.[status] ?? t(status);
}

function showStatus(config: CardConfig, snapshot: Snapshot): boolean {
  if (config.status.show !== "auto") return config.status.show;
  // Only sources that can actually be paused or idle have a status worth a
  // line of the card; a timestamp is simply running until it is over.
  return (
    snapshot.kind === "countdown" &&
    (snapshot.source === "timer" || snapshot.source === "template")
  );
}

function evaluateError(
  snapshot: ErrorSnapshot,
  config: CardConfig,
  env: EngineEnv,
): ViewModel {
  const message = env.t(`error_${snapshot.reason}`);
  const title =
    config.text.title === false
      ? undefined
      : config.text.title === "auto"
        ? (snapshot.name ?? config.entity)
        : fillPlaceholders(config.text.title, { name: snapshot.name }, env.entity);
  const detail =
    snapshot.detail &&
    (snapshot.reason === "invalid_timestamp" ||
      snapshot.reason === "invalid_number" ||
      snapshot.reason === "undetectable" ||
      snapshot.reason === "entity_missing" ||
      snapshot.reason === "template_error")
      ? snapshot.detail
      : undefined;
  return {
    kind: "error",
    status: "unknown",
    progress: null,
    outOfRange: false,
    color: "var(--disabled-color, var(--secondary-text-color))",
    effect: "none",
    hidden: false,
    texts: { title, value: message, subtitle: detail },
    ariaLabel: [title, message, detail].filter(Boolean).join(": "),
    error: snapshot,
  };
}

function evaluateCountdown(
  snapshot: CountdownSnapshot,
  config: CardConfig,
  now: number,
  env: EngineEnv,
): ViewModel {
  const { t, locale } = env;
  let status: CountdownStatus = snapshot.status;
  let remainingMs: number | undefined;
  let finishedAt = snapshot.finishedAtMs;

  if (status === "active" && snapshot.endMs !== undefined) {
    remainingMs = snapshot.endMs - now;
    // The browser reaches zero before Home Assistant says so; the card shows
    // "finished" from that moment rather than a frozen 00:00 labelled active.
    if (remainingMs <= 0) {
      status = "finished";
      finishedAt = snapshot.endMs;
      remainingMs = 0;
    }
  } else if (status === "finished") {
    remainingMs = 0;
  } else {
    remainingMs = snapshot.frozenRemainingMs;
  }

  const total =
    snapshot.startMs !== undefined && snapshot.endMs !== undefined
      ? snapshot.endMs - snapshot.startMs
      : snapshot.totalMs;

  let elapsed: number | null = null;
  if (status === "finished") elapsed = 1;
  else if (status === "idle") elapsed = total ? 0 : null;
  else if (total && total > 0 && remainingMs !== undefined) {
    elapsed = clamp01(1 - remainingMs / total);
  }
  const progress =
    elapsed === null
      ? null
      : config.progress.direction === "elapsed"
        ? elapsed
        : 1 - elapsed;

  const done = status === "finished";
  const countUp =
    done && config.on_complete.action === "count_up" && finishedAt !== undefined;
  const shownMs = countUp ? -(now - (finishedAt as number)) : (remainingMs ?? 0);

  let valueText: string;
  if (countUp) {
    valueText = `+${formatDuration(-shownMs, config.format, locale, "down").text}`;
  } else if (done && config.on_complete.action === "show_text") {
    valueText = config.on_complete.text ?? t("finished");
  } else {
    valueText = formatDuration(shownMs, config.format, locale, "up").text;
  }

  const percentText =
    progress === null
      ? undefined
      : formatPercent(progress, config.format.decimals, locale);
  const statusLabel = statusText(config, status, t);

  let endText: string | undefined;
  let endDate: string | undefined;
  const endMs =
    status === "active" ? snapshot.endMs : done ? finishedAt : undefined;
  if (endMs !== undefined) {
    const withDate = !sameDay(endMs, now, env.displayZone);
    endText = formatClock(endMs, locale, env.displayZone, withDate, env.hour12);
    endDate = formatClock(endMs, locale, env.displayZone, true, env.hour12);
  }

  const values: Record<string, string | undefined> = {
    name: snapshot.name,
    state: env.entity?.state,
    value: valueText,
    remaining: valueText,
    percentage: percentText,
    status: statusLabel,
    end_time: endText,
    end_date: endDate,
    unit: snapshot.unit,
  };

  const autoSubtitle =
    endText === undefined
      ? undefined
      : t(done ? "ended" : "ends", { time: endText });

  const texts: ViewModel["texts"] = {
    title: textFor(config.text.title, snapshot.name, values, env.entity),
    subtitle: textFor(config.text.subtitle, autoSubtitle, values, env.entity),
    value: textFor(config.text.value, valueText, values, env.entity),
    percentage:
      config.text.percentage === false
        ? undefined
        : textFor(config.text.percentage, percentText, values, env.entity),
    status: showStatus(config, snapshot) ? statusLabel : undefined,
  };

  let color = progressColor(config.colors, {
    progress,
    course: elapsed,
    remainingMs: remainingMs,
  });
  if (done && config.on_complete.color)
    color = resolveColor(config.on_complete.color) ?? color;

  const digits =
    done && config.on_complete.action === "show_text"
      ? undefined
      : digitGroups(shownMs, config.format, countUp ? "down" : "up");

  return {
    kind: "countdown",
    status,
    progress,
    remainingMs: shownMs,
    outOfRange: false,
    color,
    effect: effectFor(config, status, remainingMs),
    hidden: done && config.on_complete.action === "hide",
    texts,
    digits,
    ariaLabel: [texts.title, valueText, texts.status, percentText]
      .filter(Boolean)
      .join(", "),
  };
}

function evaluateValue(
  snapshot: ValueSnapshot,
  config: CardConfig,
  env: EngineEnv,
): ViewModel {
  const { locale } = env;
  const { value, min, max } = snapshot;
  const fraction = clamp01((value - min) / (max - min));
  const percentUnit = snapshot.unit === "%";
  const number = formatNumber(value, config.format.decimals, locale);
  const valueText = percentUnit
    ? `${number} %`
    : snapshot.unit
      ? `${number} ${snapshot.unit}`
      : number;
  const percentText = formatPercent(fraction, config.format.decimals, locale);

  const values: Record<string, string | undefined> = {
    name: snapshot.name,
    state: env.entity?.state,
    value: valueText,
    percentage: percentText,
    unit: snapshot.unit,
    status: undefined,
  };

  const texts: ViewModel["texts"] = {
    title: textFor(config.text.title, snapshot.name, values, env.entity),
    subtitle: textFor(config.text.subtitle, undefined, values, env.entity),
    value: textFor(config.text.value, valueText, values, env.entity),
    // For a percentage the value already is the percentage.
    percentage:
      config.text.percentage === false
        ? undefined
        : textFor(
            config.text.percentage,
            percentUnit ? undefined : percentText,
            values,
            env.entity,
          ),
    status:
      config.status.show === true ? statusText(config, "active", env.t) : undefined,
  };

  return {
    kind: "value",
    status: "active",
    progress: fraction,
    value,
    outOfRange: value < min || value > max,
    color: progressColor(config.colors, {
      progress: fraction,
      course: fraction,
      value,
    }),
    effect: effectFor(config, "active", undefined),
    hidden: false,
    texts,
    digits: [number],
    ariaLabel: [texts.title, valueText].filter(Boolean).join(", "),
  };
}

export function evaluate(
  snapshot: Snapshot,
  config: CardConfig,
  now: number,
  env: EngineEnv,
): ViewModel {
  switch (snapshot.kind) {
    case "countdown":
      return evaluateCountdown(snapshot, config, now, env);
    case "value":
      return evaluateValue(snapshot, config, env);
    default:
      return evaluateError(snapshot, config, env);
  }
}

/** Whether the view changes with time at all -- only a running countdown does. */
export function isTicking(snapshot: Snapshot, config: CardConfig): boolean {
  if (snapshot.kind !== "countdown") return false;
  if (snapshot.status === "active" && snapshot.endMs !== undefined) return true;
  // A finished countdown counting up keeps going.
  return snapshot.status === "finished" && config.on_complete.action === "count_up";
}
