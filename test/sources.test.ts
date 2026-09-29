import { NOW, entity, view } from "./helpers";

const iso = (ms: number) => new Date(ms).toISOString();

describe("timer", () => {
  // As timer/__init__.py writes it: duration always, remaining and finishes_at
  // only while active, remaining while paused, last_transition since 2026.5.
  const active = entity("timer.coffee", "active", {
    duration: "0:05:00",
    remaining: "0:05:00",
    finishes_at: iso(NOW + 154_000),
    last_transition: "started",
    friendly_name: "Coffee",
  });

  it("active: counts down from finishes_at, not from the stale remaining", () => {
    const { snapshot, vm } = view(active, {});
    expect(snapshot).toMatchObject({
      kind: "countdown",
      source: "timer",
      status: "active",
    });
    expect(vm.texts.value).toBe("02:34");
    expect(vm.status).toBe("active");
    expect(vm.texts.title).toBe("Coffee");
  });

  it("active: progress comes from duration and finishes_at", () => {
    const { vm } = view(active, {});
    // 154 of 300 seconds left.
    expect(vm.progress).toBeCloseTo(154 / 300, 5);
    const elapsed = view(active, { progress: { direction: "elapsed" } }).vm;
    expect(elapsed.progress).toBeCloseTo(146 / 300, 5);
  });

  it("active: the same snapshot evaluated later counts on without Home Assistant", () => {
    expect(view(active, {}, NOW + 4_000).vm.texts.value).toBe("02:30");
  });

  it("active: reaching zero locally shows finished before Home Assistant does", () => {
    const { vm } = view(active, {}, NOW + 155_000);
    expect(vm.status).toBe("finished");
    expect(vm.texts.value).toBe("00:00");
  });

  it("paused: shows the frozen remaining time and does not move", () => {
    const paused = entity("timer.coffee", "paused", {
      duration: "0:05:00",
      remaining: "0:02:00",
      last_transition: "paused",
    });
    const a = view(paused, {}).vm;
    const b = view(paused, {}, NOW + 30_000).vm;
    expect(a.status).toBe("paused");
    expect(a.texts.value).toBe("02:00");
    expect(b.texts.value).toBe("02:00");
    expect(a.progress).toBeCloseTo(0.4, 5);
    expect(a.texts.status).toBe("Paused");
  });

  it("idle: shows the full duration, no remaining attribute needed", () => {
    const idle = entity("timer.coffee", "idle", {
      duration: "0:05:00",
      last_transition: "cancelled",
    });
    const { vm } = view(idle, {});
    expect(vm.status).toBe("idle");
    expect(vm.texts.value).toBe("05:00");
    expect(vm.progress).toBe(1);
  });

  it("finished: idle with last_transition finished is finished, not idle", () => {
    const finished = entity(
      "timer.coffee",
      "idle",
      { duration: "0:05:00", last_transition: "finished" },
      iso(NOW - 12_000),
    );
    const { vm } = view(finished, {});
    expect(vm.status).toBe("finished");
    expect(vm.texts.value).toBe("00:00");
    expect(vm.progress).toBe(0);
    expect(
      view(finished, { on_complete: { action: "count_up" } }).vm.texts.value,
    ).toBe("+00:12");
    expect(
      view(finished, { on_complete: { action: "show_text", text: "Fertig" } }).vm
        .texts.value,
    ).toBe("Fertig");
    expect(view(finished, { on_complete: "hide" }).vm.hidden).toBe(true);
  });

  it("older cores without last_transition: idle stays idle", () => {
    const idle = entity("timer.coffee", "idle", {
      duration: "0:05:00",
      remaining: "0:05:00",
    });
    expect(view(idle, {}).vm.status).toBe("idle");
  });

  it("unexpected attributes: a missing duration still counts down, without progress", () => {
    const odd = entity("timer.odd", "active", { finishes_at: iso(NOW + 10_000) });
    const { vm } = view(odd, {});
    expect(vm.texts.value).toBe("00:10");
    expect(vm.progress).toBeNull();
  });

  it("active without finishes_at falls back to last_changed + remaining", () => {
    const old = entity(
      "timer.old",
      "active",
      { duration: "0:01:00", remaining: "0:01:00" },
      iso(NOW - 20_000),
    );
    expect(view(old, {}).vm.texts.value).toBe("00:40");
  });
});

describe("timestamp", () => {
  const sensor = (
    state: string,
    attributes: Record<string, unknown> = { device_class: "timestamp" },
  ) =>
    entity("sensor.next_event", state, {
      friendly_name: "Next event",
      ...attributes,
    });

  it("valid, in UTC", () => {
    const { snapshot, vm } = view(sensor("2026-09-29T20:30:00Z"), {});
    expect(snapshot).toMatchObject({ source: "timestamp", kind: "countdown" });
    expect(vm.texts.value).toBe("30:00");
  });

  it("valid, with an offset: the same instant as UTC", () => {
    expect(view(sensor("2026-09-29T22:30:00+02:00"), {}).vm.texts.value).toBe(
      "30:00",
    );
    expect(view(sensor("2026-09-29T16:30:00-04:00"), {}).vm.texts.value).toBe(
      "30:00",
    );
  });

  it("without offset: read in the server's zone (Berlin in the fixture)", () => {
    expect(
      view(sensor("2026-09-29T22:30:00", {}), { source: "timestamp" }).vm.texts
        .value,
    ).toBe("30:00");
  });

  it("expired: finished, and count_up says how long ago", () => {
    const past = sensor("2026-09-29T19:59:15Z");
    expect(view(past, {}).vm.status).toBe("finished");
    expect(view(past, {}).vm.texts.value).toBe("00:00");
    expect(view(past, { on_complete: "count_up" }).vm.texts.value).toBe("+00:45");
  });

  it("invalid: a readable error, not a crash", () => {
    const { vm } = view(sensor("next tuesday"), { source: "timestamp" });
    expect(vm.kind).toBe("error");
    expect(vm.texts.value).toBe("Invalid timestamp");
    expect(vm.texts.subtitle).toBe("next tuesday");
  });

  it("from an attribute", () => {
    const e = entity("sensor.some_event", "on", {
      timestamp: "2026-09-29T21:00:00Z",
    });
    const { vm } = view(e, {
      source: { type: "timestamp", attribute: "timestamp" },
    });
    expect(vm.texts.value).toBe("01:00:00");
  });

  it("no progress without a start; progress.window supplies one", () => {
    const e = sensor("2026-09-29T21:00:00Z");
    expect(view(e, {}).vm.progress).toBeNull();
    const windowed = view(e, { progress: { window: "2h" } }).vm;
    // 1h of a 2h window left.
    expect(windowed.progress).toBeCloseTo(0.5, 5);
  });

  it("progress.start from another entity", () => {
    const e = sensor("2026-09-29T21:00:00Z");
    const start = entity("sensor.start", "2026-09-29T19:00:00Z");
    const { vm } = view(
      e,
      { progress: { start: { entity: "sensor.start" } } },
      NOW,
      undefined,
      [start],
    );
    expect(vm.progress).toBeCloseTo(0.5, 5);
  });

  it("input_datetime with date and time, written without an offset", () => {
    const e = entity("input_datetime.alarm", "2026-09-29 23:00:00", {
      has_date: true,
      has_time: true,
    });
    expect(view(e, {}).vm.texts.value).toBe("01:00:00");
  });

  it("input_datetime with only a time: the next occurrence", () => {
    const e = entity("input_datetime.alarm", "06:30:00", {
      has_date: false,
      has_time: true,
    });
    expect(view(e, {}).vm.texts.value).toBe("08:30:00");
  });

  it("ends subtitle shows the wall-clock time in the display zone", () => {
    expect(view(sensor("2026-09-29T20:30:00Z"), {}).vm.texts.subtitle).toBe(
      "Ends 22:30",
    );
  });
});

describe("percentage", () => {
  const pct = (
    state: string,
    attrs: Record<string, unknown> = { unit_of_measurement: "%" },
  ) => entity("sensor.progress", state, attrs);

  it.each([
    ["0", 0, "0 %"],
    ["50", 0.5, "50 %"],
    ["100", 1, "100 %"],
    ["73", 0.73, "73 %"],
  ])("%s", (state, progress, text) => {
    const { vm } = view(pct(state), {});
    expect(vm.progress).toBeCloseTo(progress, 5);
    expect(vm.texts.value).toBe(text);
    expect(vm.outOfRange).toBe(false);
  });

  it('"73%" as a template sensor writes it', () => {
    const { snapshot, vm } = view(pct("73%", {}), {});
    expect(snapshot.source).toBe("percentage");
    expect(vm.progress).toBeCloseTo(0.73, 5);
  });

  it("above 100: drawn full, shown as it is", () => {
    const { vm } = view(pct("104"), {});
    expect(vm.progress).toBe(1);
    expect(vm.texts.value).toBe("104 %");
    expect(vm.outOfRange).toBe(true);
  });

  it("below 0: drawn empty, shown as it is", () => {
    const { vm } = view(pct("-3"), {});
    expect(vm.progress).toBe(0);
    expect(vm.texts.value).toBe("-3 %");
    expect(vm.outOfRange).toBe(true);
  });

  it("not a number", () => {
    const { vm } = view(pct("n/a"), { source: "percentage" });
    expect(vm.kind).toBe("error");
    expect(vm.texts.value).toBe("Not a number");
  });

  it("a timestamp is never read as the number 2026", () => {
    const { vm } = view(pct("2026-09-29T14:16:25+00:00", {}), {
      source: "percentage",
    });
    expect(vm.kind).toBe("error");
  });

  it("numeric takes min/max from the entity", () => {
    const e = entity("input_number.volume", "30", { min: 0, max: 60 });
    expect(view(e, {}).vm.progress).toBeCloseTo(0.5, 5);
    expect(view(e, { progress: { max: 120 } }).vm.progress).toBeCloseTo(0.25, 5);
  });
});

describe("auto detection", () => {
  it.each([
    [entity("timer.a", "idle", { duration: "0:01:00" }), "timer"],
    [
      entity("sensor.b", "2026-09-30T06:00:00+00:00", {
        device_class: "timestamp",
      }),
      "timestamp",
    ],
    [entity("sensor.c", "2026-09-30T06:00:00+00:00"), "timestamp"],
    [
      entity("sensor.d", "87", {
        device_class: "battery",
        unit_of_measurement: "%",
      }),
      "percentage",
    ],
    [entity("sensor.e", "42"), "numeric"],
  ])("%s", (ent, source) => {
    expect(view(ent, {}).snapshot.source).toBe(source);
  });

  it("gives up honestly on text it cannot read", () => {
    const { vm } = view(entity("sensor.f", "washing"), {});
    expect(vm.texts.value).toBe("Cannot tell what this entity holds");
  });

  it("source.map turns program states into numbers", () => {
    const e = entity("sensor.washer", "rinse");
    const { vm } = view(e, {
      source: { type: "numeric", map: { wash: 30, rinse: 70, spin: 90 } },
    });
    expect(vm.progress).toBeCloseTo(0.7, 5);
  });

  it("an attribute is interpreted by what it holds", () => {
    const e = entity("vacuum.robot", "cleaning", { battery_level: 64 });
    expect(
      view(e, { source: { attribute: "battery_level" } }).vm.progress,
    ).toBeCloseTo(0.64, 5);
  });
});

describe("entity errors", () => {
  it("missing entity", () => {
    const { vm } = view(undefined, { entity: "sensor.gone" });
    expect(vm.texts.value).toBe("Entity not found");
    expect(vm.texts.subtitle).toBe("sensor.gone");
  });

  it("unavailable", () => {
    expect(view(entity("sensor.x", "unavailable"), {}).vm.texts.value).toBe(
      "Entity unavailable",
    );
  });

  it("unknown", () => {
    expect(view(entity("sensor.x", "unknown"), {}).vm.texts.value).toBe(
      "No value yet",
    );
  });

  it("in German", () => {
    const { vm } = view(entity("sensor.x", "unavailable"), {});
    expect(vm.kind).toBe("error");
  });
});

describe("template", () => {
  const cfg = { source: { type: "template" as const, template: "{{ x }}" } };

  it("loading and error states", () => {
    expect(view(undefined, cfg, NOW, { status: "loading" }).vm.texts.value).toBe(
      "Loading…",
    );
    const err = view(undefined, cfg, NOW, {
      status: "error",
      error: "UndefinedError: x",
    }).vm;
    expect(err.texts.value).toBe("Template error");
    expect(err.texts.subtitle).toBe("UndefinedError: x");
  });

  it("a timestamp string", () => {
    const { vm } = view(undefined, cfg, NOW, {
      status: "ready",
      value: "2026-09-29T20:10:00Z",
    });
    expect(vm.texts.value).toBe("10:00");
  });

  it("a number", () => {
    const { vm } = view(undefined, cfg, NOW, { status: "ready", value: 25 });
    expect(vm.progress).toBeCloseTo(0.25, 5);
  });

  it("a mapping with start and end", () => {
    const { vm } = view(undefined, cfg, NOW, {
      status: "ready",
      value: {
        start: "2026-09-29T19:00:00Z",
        end: "2026-09-29T21:00:00Z",
        name: "Dishwasher",
      },
    });
    expect(vm.texts.title).toBe("Dishwasher");
    expect(vm.progress).toBeCloseTo(0.5, 5);
  });

  it("a mapping with a value and range", () => {
    const { vm } = view(undefined, cfg, NOW, {
      status: "ready",
      value: { value: 3, min: 0, max: 12 },
    });
    expect(vm.progress).toBeCloseTo(0.25, 5);
  });
});
