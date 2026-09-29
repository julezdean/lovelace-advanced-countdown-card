// Mock Home Assistant for the demo harness. Entity shapes mirror what core
// writes -- timer attributes per state exactly as timer/__init__.py produces
// them, timestamps as ISO strings with microseconds and an offset -- including
// the awkward cases the card has to survive.

import { ICONS } from "./icons.js";

const iso = (ms) => {
  // Home Assistant writes microseconds and +00:00, not Z.
  const d = new Date(ms).toISOString().replace("Z", "");
  return `${d}123+00:00`;
};

const hms = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

function entity(entity_id, state, attributes = {}, lastChanged) {
  return {
    entity_id,
    state,
    attributes,
    last_changed: lastChanged,
    last_updated: lastChanged,
    context: { id: "demo", parent_id: null, user_id: null },
  };
}

/**
 * @param now   the instant every relative time is built from
 * @param opts  { dark, language }
 */
export function makeHass(now, opts = {}) {
  const ago = (s) => iso(now - s * 1000);
  const inSeconds = (s) => iso(now + s * 1000);

  const states = [
    entity("timer.coffee", "active", {
      duration: "0:05:00",
      remaining: "0:05:00",
      finishes_at: inSeconds(154.4),
      last_transition: "started",
      editable: true,
      friendly_name: "Coffee machine",
      icon: "mdi:coffee",
    }, ago(146)),
    entity("timer.pizza", "paused", {
      duration: "0:12:00",
      remaining: "0:04:30",
      last_transition: "paused",
      editable: true,
      friendly_name: "Pizza",
      icon: "mdi:pizza",
    }, ago(40)),
    entity("timer.tea", "idle", {
      duration: "0:04:00",
      last_transition: "finished",
      editable: true,
      friendly_name: "Tea",
      icon: "mdi:tea",
    }, ago(83)),
    entity("timer.egg", "idle", {
      duration: "0:07:00",
      last_transition: "cancelled",
      editable: true,
      friendly_name: "Eggs",
      icon: "mdi:timer-sand",
    }, ago(600)),
    entity("sensor.washing_machine_progress", "73", {
      unit_of_measurement: "%",
      friendly_name: "Washing machine",
      icon: "mdi:washing-machine",
    }, ago(30)),
    entity("sensor.phone_battery", "87", {
      unit_of_measurement: "%",
      device_class: "battery",
      friendly_name: "Phone",
      icon: "mdi:battery-80",
    }, ago(300)),
    entity("sensor.ev_charge", "104", {
      unit_of_measurement: "%",
      friendly_name: "Car charge (reports over 100)",
      icon: "mdi:car-electric",
    }, ago(300)),
    entity("sensor.next_launch", inSeconds(2 * 86400 + 4 * 3600 + 12 * 60 + 9), {
      device_class: "timestamp",
      friendly_name: "Launch window",
      icon: "mdi:rocket-launch-outline",
    }, ago(3600)),
    entity("sensor.dishwasher_end", inSeconds(47 * 60 + 12), {
      device_class: "timestamp",
      friendly_name: "Dishwasher",
      icon: "mdi:dishwasher",
    }, ago(600)),
    entity("sensor.dishwasher_start", ago(72 * 60), {
      device_class: "timestamp",
      friendly_name: "Dishwasher started",
    }, ago(72 * 60)),
    entity("sensor.oven_ready", inSeconds(11 * 60 + 40), {
      device_class: "timestamp",
      friendly_name: "Oven preheated",
      icon: "mdi:stove",
    }, ago(60)),
    entity("sensor.bad_timestamp", "next tuesday", {
      device_class: "timestamp",
      friendly_name: "Broken sensor",
    }, ago(60)),
    entity("sensor.offline", "unavailable", { friendly_name: "Offline sensor" }, ago(60)),
    entity("input_datetime.alarm", "06:30:00", {
      has_date: false,
      has_time: true,
      friendly_name: "Alarm",
      icon: "mdi:alarm",
    }, ago(9000)),
  ];

  const language = opts.language ?? "en";
  return {
    states: Object.fromEntries(states.map((s) => [s.entity_id, s])),
    connection: {
      // render_template, answered from the mock: a timestamp 25 minutes out.
      subscribeMessage: async (callback, message) => {
        if (message.type !== "render_template") throw new Error("unsupported");
        if (message.template.includes("{% broken")) {
          throw { code: "template_error", message: "unexpected '}'" };
        }
        setTimeout(() => callback({ result: { end: inSeconds(25 * 60), start: ago(35 * 60), name: "Bread rising" }, listeners: {} }), 20);
        return async () => undefined;
      },
    },
    locale: { language, time_zone: "server", time_format: "24" },
    config: { time_zone: "Europe/Berlin" },
    themes: { darkMode: !!opts.dark },
    language,
  };
}

/** Stand-ins for the three Home Assistant elements the card uses. */
export function defineHaStandIns() {
  if (customElements.get("ha-card")) return;

  customElements.define("ha-card", class extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;
      this.attachShadow({ mode: "open" }).innerHTML = `<style>
        :host{display:block;
          background:var(--ha-card-background,var(--card-background-color,#fff));
          border-radius:var(--ha-card-border-radius,12px);
          border:var(--ha-card-border-width,1px) solid var(--ha-card-border-color,var(--divider-color,#e0e0e0));
          box-shadow:var(--ha-card-box-shadow,none);}
      </style><slot></slot>`;
    }
  });

  const draw = (el, name) => {
    const path = ICONS[name] ?? ICONS["mdi:timer-outline"];
    el.shadowRoot.innerHTML = `<style>:host{display:inline-flex;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)}
      svg{width:100%;height:100%;fill:currentColor}</style>
      <svg viewBox="0 0 24 24"><path d="${path}"></path></svg>`;
  };

  customElements.define("ha-icon", class extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: "open" }); }
    set icon(v) { this._icon = v; draw(this, v); }
    get icon() { return this._icon; }
  });

  const DOMAIN_ICON = { timer: "mdi:timer-outline", input_datetime: "mdi:calendar-clock", sensor: "mdi:counter" };
  customElements.define("ha-state-icon", class extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: "open" }); }
    set stateObj(v) { this._s = v; this._draw(); }
    set icon(v) { this._i = v; this._draw(); }
    _draw() {
      const s = this._s;
      draw(this, this._i || s?.attributes?.icon || DOMAIN_ICON[s?.entity_id?.split(".")[0]] || "mdi:timer-outline");
    }
  });
}

export const THEME_CSS = `
  :root {
    --primary-text-color: #141414;
    --secondary-text-color: #5e6368;
    --divider-color: #e3e5e8;
    --primary-color: #0b7a75;
    --accent-color: #ff9800;
    --card-background-color: #ffffff;
    --ha-card-background: #ffffff;
    --ha-card-border-radius: 12px;
    --warning-color: #e08b00;
    --success-color: #2e8540;
    --error-color: #db4437;
    --disabled-color: #9ea3a8;
    --red-color: #e53935; --green-color: #43a047; --amber-color: #ffb300;
    --blue-color: #1e88e5; --orange-color: #fb8c00; --purple-color: #8e24aa;
    --deep-purple-color: #5e35b1; --teal-color: #00897b; --light-blue-color: #039be5;
    --page: #f1f3f5;
  }
  body.dark {
    --primary-text-color: #e4e6e8;
    --secondary-text-color: #9aa0a6;
    --divider-color: #2b2e31;
    --primary-color: #34b3ab;
    --card-background-color: #1c1d1f;
    --ha-card-background: #1c1d1f;
    --disabled-color: #6b7075;
    --page: #111214;
  }
`;
