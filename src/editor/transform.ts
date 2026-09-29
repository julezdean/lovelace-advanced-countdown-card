import { expandShorthands, normalizeConfig } from "../core/config";
import type { UserCardConfig } from "../types";

/**
 * Config <-> form data.
 *
 * The YAML is nested (source:, display:, ...) and so is the form: each
 * expandable section is named after its config key and has no `flatten`, so
 * ha-form reads and writes it under data[name] --
 *   getValue = (obj, item) => !item.name || item.flatten ? obj : obj[item.name]
 * (frontend/src/components/ha-form/ha-form.ts) -- which is exactly the nesting
 * the config already has.
 *
 * Three things do not map one to one and are translated here:
 *  - `false` in a text area, which a select cannot hold  -> "__hidden"
 *  - auto / true / false switches                         -> "auto" / "show" / "hide"
 *  - `icon: false`                                        -> icon.visible: false
 *
 * The form is seeded with every default, so no control appears empty for an
 * option that is in fact active -- but only what differs from the defaults is
 * written back, or a two-line card would turn into sixty lines of YAML on the
 * first click.
 */

type Obj = Record<string, unknown>;

export const HIDDEN = "__hidden";
const TEXT_KEYS = ["title", "subtitle", "value", "percentage"];
const TRISTATE: [string, string][] = [
  ["format", "show_days"],
  ["format", "show_hours"],
  ["format", "show_minutes"],
  ["format", "show_seconds"],
  ["status", "show"],
];
const SECTIONS = [
  "source",
  "progress",
  "display",
  "format",
  "colors",
  "animation",
  "on_complete",
  "status",
  "icon",
  "text",
  "layout",
  "appearance",
];

const isObj = (value: unknown): value is Obj =>
  !!value && typeof value === "object" && !Array.isArray(value);

const tristateToForm = (value: unknown) =>
  value === true ? "show" : value === false ? "hide" : (value ?? "auto");
const tristateFromForm = (value: unknown) =>
  value === "show" ? true : value === "hide" ? false : value;

/**
 * The defaults that apply to THIS config: a bar's style default is not a
 * ring's, and a donut is thicker than a ring. The discriminators themselves
 * (display.type, display.style, source.type) are compared against the global
 * defaults -- otherwise the value just chosen would count as its own default
 * and be dropped.
 */
function defaultsFor(config: Obj): Obj {
  const display = isObj(config.display) ? config.display : {};
  const make = (extra: Partial<UserCardConfig>): Obj => {
    try {
      return normalizeConfig({
        type: "",
        entity: "sensor.placeholder",
        ...extra,
      }) as unknown as Obj;
    } catch {
      return normalizeConfig({
        type: "",
        entity: "sensor.placeholder",
      }) as unknown as Obj;
    }
  };
  const global = make({});
  const byType = make({ display: { type: display.type as never } });
  const byStyle = make({
    display: { type: display.type as never, style: display.style as never },
  });
  const out: Obj = { ...global };
  out.display = {
    ...(byType.display as Obj),
    type: (global.display as Obj).type,
    thickness: (byStyle.display as Obj).thickness,
  };
  return out;
}

export function toForm(config: UserCardConfig): Obj {
  const raw = expandShorthands(config);
  const defaults = defaultsFor(raw);
  const data: Obj = { ...raw };

  for (const key of SECTIONS) {
    const own = isObj(raw[key]) ? (raw[key] as Obj) : {};
    data[key] = { ...(defaults[key] as Obj), ...own };
  }

  const text = data.text as Obj;
  for (const key of TEXT_KEYS) {
    if (text[key] === false) text[key] = HIDDEN;
    if (text[key] === true) text[key] = "auto";
  }
  for (const [section, key] of TRISTATE) {
    const obj = data[section] as Obj;
    obj[key] = tristateToForm(obj[key]);
  }

  const icon = data.icon as Obj;
  icon.visible = icon.icon !== false;
  icon.icon = icon.icon === false || icon.icon === "auto" ? "" : icon.icon;

  delete (data.colors as Obj).thresholds; // YAML only; kept from the config
  delete data.debug;
  return data;
}

function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The form's own encodings (__hidden, show/hide, icon.visible) undone. */
function fromSeed(form: Obj): Obj {
  const data: Obj = { ...form };
  if (isObj(data.text)) {
    const text = { ...(data.text as Obj) };
    for (const key of TEXT_KEYS) if (text[key] === HIDDEN) text[key] = false;
    data.text = text;
  }
  for (const [section, key] of TRISTATE) {
    if (isObj(data[section])) {
      data[section] = {
        ...(data[section] as Obj),
        [key]: tristateFromForm((data[section] as Obj)[key]),
      };
    }
  }
  if (isObj(data.icon)) {
    const { visible, ...icon } = data.icon as Obj;
    icon.icon = visible === false ? false : icon.icon ? icon.icon : "auto";
    data.icon = icon;
  }
  return data;
}

export function fromForm(form: Obj, previous: UserCardConfig): UserCardConfig {
  const data: Obj = { ...form };
  const defaults = defaultsFor(data);
  const before = expandShorthands(previous);
  // What the form was seeded with. A seeded value nobody touched is never
  // written: switching ring -> donut must not pin the ring's thickness.
  const seeded = fromSeed(toForm(previous));

  const decoded = fromSeed(data);
  if (isObj(decoded.text)) {
    const text = decoded.text as Obj;
    for (const key of TEXT_KEYS) if (text[key] === "") text[key] = "auto";
  }

  const out: Obj = {};
  for (const [key, value] of Object.entries(decoded)) {
    if (!SECTIONS.includes(key)) {
      if (value !== undefined && value !== "") out[key] = value;
      continue;
    }
    if (!isObj(value)) continue;
    const reference = isObj(defaults[key]) ? (defaults[key] as Obj) : {};
    const kept: Obj = {};
    for (const [field, entry] of Object.entries(value)) {
      if (entry === undefined || entry === null || entry === "") continue;
      if (field in reference && equal(reference[field], entry)) continue;
      const setBefore = isObj(before[key]) && field in (before[key] as Obj);
      const seed = isObj(seeded[key]) ? (seeded[key] as Obj)[field] : undefined;
      if (!setBefore && equal(seed, entry)) continue;
      kept[field] = entry;
    }
    // Anything the form does not show (thresholds, labels, map) survives.
    const hidden = isObj(before[key]) ? (before[key] as Obj) : {};
    for (const field of ["thresholds", "labels", "map"]) {
      if (field in hidden && !(field in kept)) kept[field] = hidden[field];
    }
    if (Object.keys(kept).length) out[key] = kept;
  }
  if (previous.debug) out.debug = previous.debug;
  return out as unknown as UserCardConfig;
}
