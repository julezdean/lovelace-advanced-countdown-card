// The configurations the demo and the screenshots show. One list, so a
// screenshot always pictures a configuration that the gallery also runs.
//
// Each scene shows one idea. A scene chosen to show a special case (the
// error states, the finished timer) keeps showing it -- a new demo goes into a
// new scene rather than displacing the case an existing image was made for.

export const SCENES = {
  hero: {
    title: "Four sources, four visualisations",
    cards: [
      { entity: "timer.coffee", display: { type: "circle" }, status: true },
      {
        entity: "sensor.dishwasher_end",
        display: { type: "radial" },
        progress: { start: { entity: "sensor.dishwasher_start" } },
      },
      { entity: "sensor.washing_machine_progress", display: { type: "bar" } },
      { entity: "sensor.next_launch", display: { type: "digital" }, text: { subtitle: "auto" } },
    ],
  },

  renderers: {
    title: "display.type -- the same timer six ways",
    cards: [
      { entity: "timer.coffee", display: "circle" },
      { entity: "timer.coffee", display: { type: "circle", style: "donut" }, icon: { position: "inner" } },
      { entity: "timer.coffee", display: "radial" },
      { entity: "timer.coffee", display: "bar" },
      { entity: "timer.coffee", display: { type: "segments", segments: 10 } },
      { entity: "timer.coffee", display: "digital" },
      { entity: "timer.coffee", display: "numeric" },
    ],
  },

  timer_states: {
    title: "Timer states: active, paused, finished, idle",
    cards: [
      { entity: "timer.coffee", status: true },
      { entity: "timer.pizza" },
      { entity: "timer.tea", on_complete: { action: "count_up" } },
      { entity: "timer.egg" },
    ],
  },

  layouts: {
    title: "layout.orientation: horizontal",
    cards: [
      { entity: "timer.coffee", layout: "horizontal", display: { type: "circle", size: "small" } },
      { entity: "sensor.washing_machine_progress", layout: "horizontal", display: { type: "bar" }, text: { subtitle: "Rinse cycle" } },
      { entity: "sensor.oven_ready", layout: "horizontal", display: { type: "segments", segments: 12 }, progress: { window: "20m" } },
    ],
  },

  colors: {
    title: "Thresholds and a gradient over the course",
    cards: [
      {
        entity: "sensor.phone_battery",
        display: { type: "circle", style: "donut" },
        colors: {
          mode: "thresholds",
          thresholds: [
            { value: 60, color: "green" },
            { value: 25, color: "amber" },
            { value: 0, color: "red" },
          ],
        },
      },
      {
        entity: "sensor.dishwasher_end",
        display: { type: "bar", gradient: true, thickness: 12 },
        progress: { start: { entity: "sensor.dishwasher_start" }, direction: "elapsed" },
        colors: { primary: "light-blue", secondary: "deep-purple" },
        text: { percentage: true },
      },
      {
        entity: "sensor.oven_ready",
        display: { type: "radial" },
        progress: { window: "20m" },
        colors: { mode: "gradient", start: "green", end: "red" },
      },
    ],
  },

  compact: {
    title: "Compact and minimal",
    cards: [
      { entity: "timer.coffee", layout: { density: "compact" }, display: { type: "circle", size: "small" } },
      { entity: "sensor.ev_charge", layout: { density: "compact" }, display: { type: "bar", style: "thin" } },
      { entity: "timer.pizza", layout: { density: "minimal" }, display: "digital" },
    ],
  },

  errors: {
    title: "Bad data does not break the card",
    cards: [
      { entity: "sensor.offline" },
      { entity: "sensor.bad_timestamp" },
      { entity: "sensor.does_not_exist" },
    ],
  },

  template: {
    title: "source.type: template",
    cards: [
      {
        source: {
          type: "template",
          template:
            "{{ {'start': states('sensor.dough_start'), 'end': states('sensor.dough_end'), 'name': 'Bread rising'} }}",
        },
        display: "circle",
        icon: "mdi:timer-sand",
      },
    ],
  },
};
