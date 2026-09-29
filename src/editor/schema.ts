import { HIDDEN } from "./transform";

/**
 * The visual editor's form. Sections are named after their config keys and
 * have no `flatten`, so they bind to the nested YAML directly (see
 * transform.ts). What is not here is YAML only, deliberately:
 *   colors.thresholds, status.labels, source.map, progress.start/end as an
 *   entity reference -- lists and mappings that a form would make worse.
 */

export interface FormSchema {
  name: string;
  type?: string;
  title?: string;
  required?: boolean;
  flatten?: boolean;
  selector?: Record<string, unknown>;
  schema?: FormSchema[];
}

type Option = [value: string, label: string];

const select = (
  name: string,
  options: Option[],
  extra: Record<string, unknown> = {},
): FormSchema => ({
  name,
  selector: {
    select: {
      mode: "dropdown",
      options: options.map(([value, label]) => ({ value, label })),
      ...extra,
    },
  },
});
const bool = (name: string): FormSchema => ({ name, selector: { boolean: {} } });
const text = (name: string): FormSchema => ({ name, selector: { text: {} } });
const number = (
  name: string,
  min: number,
  max: number,
  step = 1,
  mode = "box",
): FormSchema => ({
  name,
  selector: { number: { min, max, step, mode } },
});
const section = (
  name: string,
  title: string,
  schema: FormSchema[],
): FormSchema => ({
  name,
  type: "expandable",
  title,
  schema,
});

const TRISTATE: Option[] = [
  ["auto", "Automatic"],
  ["show", "Show"],
  ["hide", "Hide"],
];
/** A select that also takes free text: the placeholders live there. */
const textSlot = (name: string): FormSchema =>
  select(
    name,
    [
      ["auto", "Automatic"],
      [HIDDEN, "Hidden"],
    ],
    { custom_value: true },
  );
const EFFECTS: Option[] = [
  ["none", "None"],
  ["pulse", "Pulse"],
  ["glow", "Glow"],
  ["breathing", "Breathing"],
  ["rotate", "Rotate the icon"],
];
const ACTIONS = {
  ui_action: {
    actions: [
      "more-info",
      "navigate",
      "url",
      "toggle",
      "perform-action",
      "assist",
      "none",
    ],
  },
};

export const SCHEMA: FormSchema[] = [
  { name: "entity", selector: { entity: {} } },

  section("source", "Source", [
    select("type", [
      ["auto", "Detect automatically"],
      ["timer", "Timer"],
      ["timestamp", "Timestamp"],
      ["percentage", "Percentage (0–100)"],
      ["numeric", "Number with a range"],
      ["state", "State, detect type"],
      ["attribute", "Attribute, detect type"],
      ["template", "Template"],
    ]),
    text("attribute"),
    { name: "template", selector: { template: {} } },
    select("naive_timezone", [
      ["server", "Server time zone"],
      ["browser", "Browser time zone"],
    ]),
  ]),

  section("display", "Display", [
    select("type", [
      ["circle", "Circle"],
      ["radial", "Gauge"],
      ["bar", "Bar"],
      ["segments", "Segments"],
      ["digital", "Digital"],
      ["numeric", "Number only"],
    ]),
    select("inner", [
      ["value", "Countdown / value"],
      ["percentage", "Percentage"],
      ["icon", "Icon"],
      ["none", "Nothing"],
    ]),
    select("style", [
      ["ring", "Ring"],
      ["donut", "Donut"],
      ["default", "Bar"],
      ["thin", "Thin bar"],
    ]),
    number("thickness", 1, 40, 1, "slider"),
    select("size", [
      ["small", "Small"],
      ["medium", "Medium"],
      ["large", "Large"],
    ]),
    select("orientation", [
      ["horizontal", "Horizontal"],
      ["vertical", "Vertical"],
    ]),
    number("segments", 2, 60),
    number("arc", 90, 340, 10, "slider"),
    bool("rounded"),
    bool("track"),
    bool("gradient"),
  ]),

  section("layout", "Layout", [
    select("orientation", [
      ["vertical", "Stacked"],
      ["horizontal", "Side by side"],
    ]),
    select("density", [
      ["normal", "Normal"],
      ["compact", "Compact"],
      ["minimal", "Minimal"],
    ]),
    select("align", [
      ["center", "Centred"],
      ["start", "Left"],
    ]),
  ]),

  section("format", "Countdown", [
    select("style", [
      ["auto", "Automatic"],
      ["SS", "SS"],
      ["MM:SS", "MM:SS"],
      ["HH:MM:SS", "HH:MM:SS"],
      ["DD:HH:MM:SS", "DD:HH:MM:SS"],
      ["short", "2h 34m"],
      ["long", "2 hours, 34 minutes"],
    ]),
    number("largest_units", 1, 4),
    select("show_days", TRISTATE),
    select("show_hours", TRISTATE),
    select("show_minutes", TRISTATE),
    select("show_seconds", TRISTATE),
    number("decimals", 0, 3),
  ]),

  section("progress", "Progress", [
    select("direction", [
      ["remaining", "Remaining (100 → 0 %)"],
      ["elapsed", "Elapsed (0 → 100 %)"],
    ]),
    text("start"),
    text("window"),
    number("min", -1e9, 1e9, 0.1),
    number("max", -1e9, 1e9, 0.1),
  ]),

  section("on_complete", "When finished", [
    select("action", [
      ["show_zero", "Show 00:00"],
      ["show_text", "Show a text"],
      ["count_up", "Count up"],
      ["hide", "Hide the card"],
    ]),
    text("text"),
    text("color"),
    select("effect", EFFECTS),
  ]),

  section("colors", "Colours", [
    select("mode", [
      ["static", "One colour"],
      ["gradient", "Changes over the course"],
      ["thresholds", "Thresholds (set in YAML)"],
    ]),
    text("primary"),
    text("secondary"),
    text("start"),
    text("end"),
    text("track"),
    text("text"),
    select("basis", [
      ["progress", "Progress in %"],
      ["remaining_seconds", "Remaining seconds"],
      ["value", "Raw value"],
    ]),
  ]),

  section("animation", "Animation", [
    bool("enabled"),
    select("progress", [
      ["smooth", "Smooth"],
      ["tick", "Step each second"],
      ["none", "None"],
    ]),
    select("digits", [
      ["none", "None"],
      ["flip", "Flip"],
      ["fade", "Fade"],
    ]),
    select("effect", EFFECTS),
    select("effect_when", [
      ["active", "While running"],
      ["finishing", "In the last seconds"],
      ["finished", "When finished"],
      ["always", "Always"],
    ]),
    number("finishing_seconds", 1, 3600),
    select("speed", [
      ["slow", "Slow"],
      ["normal", "Normal"],
      ["fast", "Fast"],
    ]),
  ]),

  section("text", "Text", [
    textSlot("title"),
    textSlot("subtitle"),
    textSlot("value"),
    textSlot("percentage"),
  ]),

  section("status", "Status", [select("show", TRISTATE)]),

  section("icon", "Icon", [
    bool("visible"),
    { name: "icon", selector: { icon: {} } },
    select("position", [
      ["left", "Left"],
      ["top", "Top"],
      ["inner", "Inside the ring"],
    ]),
    number("size", 0.5, 4, 0.1),
    text("color"),
  ]),

  section("appearance", "Appearance", [bool("glass"), text("background")]),

  section("actions", "Actions", [
    { name: "tap_action", selector: ACTIONS },
    { name: "hold_action", selector: ACTIONS },
    { name: "double_tap_action", selector: ACTIONS },
  ]),
];

/** The actions section is the one flattened group: the keys are top-level. */
(SCHEMA.find((item) => item.name === "actions") as FormSchema).flatten = true;

export const LABELS: Record<string, string> = {
  entity: "Entity",
  type: "Type",
  attribute: "Attribute (empty = state)",
  template: "Template (Jinja, rendered by Home Assistant)",
  naive_timezone: "Timestamps without an offset are in",
  inner: "Inside the ring",
  style: "Style",
  thickness: "Thickness",
  size: "Size",
  orientation: "Orientation",
  segments: "Segments",
  arc: "Gauge opening (degrees)",
  rounded: "Rounded ends",
  track: "Show the track",
  gradient: "Gradient from primary to secondary",
  density: "Density",
  align: "Alignment",
  largest_units: "Units shown (2h 34m = 2)",
  show_days: "Days",
  show_hours: "Hours",
  show_minutes: "Minutes",
  show_seconds: "Seconds",
  decimals: "Decimals",
  direction: "Direction",
  start: "Start (ISO time, or last_changed)",
  window: "Window before the end (e.g. 24h)",
  min: "Minimum",
  max: "Maximum",
  action: "Then",
  text: "Text",
  color: "Colour",
  effect: "Effect",
  mode: "Mode",
  primary: "Primary colour",
  secondary: "Secondary colour",
  end: "End colour",
  basis: "Thresholds compare",
  enabled: "Animations",
  progress: "Progress movement",
  digits: "Digit change",
  effect_when: "Effect runs",
  finishing_seconds: "Last seconds",
  speed: "Speed",
  title: "Title ({name}, {end_time}, … allowed)",
  subtitle: "Subtitle",
  value: "Value",
  percentage: "Percentage",
  show: "Show status",
  visible: "Show icon",
  icon: "Icon (empty = the entity's)",
  position: "Position",
  glass: "Glass effect (needs a view background image)",
  background: "Card background",
  tap_action: "Tap",
  hold_action: "Hold",
  double_tap_action: "Double tap",
};
