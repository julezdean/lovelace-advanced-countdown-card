import { NOW, entity, view } from "./helpers";
import { mixColors, pickThreshold, resolveColor } from "../src/utils/colors";

const iso = (ms: number) => new Date(ms).toISOString();

/** A timestamp countdown from 20:00 to 21:00, evaluated at a chosen moment. */
const hour = entity("sensor.show", "2026-09-29T21:00:00Z", {
  device_class: "timestamp",
});
const hourCfg = { progress: { start: "2026-09-29T20:00:00Z" } };

describe("progress", () => {
  it("the specification's example: 20:00 to 21:00, now 20:25 -> 41.67 % elapsed", () => {
    const vm = view(
      hour,
      { ...hourCfg, progress: { ...hourCfg.progress, direction: "elapsed" } },
      NOW + 25 * 60_000,
    ).vm;
    expect(vm.progress! * 100).toBeCloseTo(41.667, 2);
  });

  it.each([
    [0, 1, 0],
    [30, 0.5, 0.5],
    [60, 0, 1],
  ])("at +%i min: remaining %d, elapsed %d", (minutes, remaining, elapsed) => {
    const at = NOW + minutes * 60_000;
    expect(view(hour, hourCfg, at).vm.progress).toBeCloseTo(remaining, 5);
    expect(
      view(hour, { progress: { ...hourCfg.progress, direction: "elapsed" } }, at).vm
        .progress,
    ).toBeCloseTo(elapsed, 5);
  });

  it("never leaves 0..1 outside the window", () => {
    expect(view(hour, hourCfg, NOW - 10 * 60_000).vm.progress).toBe(1);
    expect(view(hour, hourCfg, NOW + 90 * 60_000).vm.progress).toBe(0);
  });

  it("a start after the end carries no proportion", () => {
    expect(
      view(hour, { progress: { start: "2026-09-29T22:00:00Z" } }).vm.progress,
    ).toBeNull();
  });

  it("percentage text follows the configured decimals", () => {
    const vm = view(
      hour,
      { ...hourCfg, text: { percentage: true }, format: { decimals: 1 } },
      NOW + 25 * 60_000,
    ).vm;
    expect(vm.texts.percentage).toBe("58.3 %");
  });
});

describe("countdown magnitudes", () => {
  const at = (ms: number) =>
    view(entity("sensor.t", iso(NOW + ms), { device_class: "timestamp" }), {}).vm
      .texts.value;

  it("seconds", () => expect(at(9_000)).toBe("00:09"));
  it("minutes", () => expect(at(12 * 60_000 + 5_000)).toBe("12:05"));
  it("hours", () => expect(at(5 * 3_600_000 + 60_000)).toBe("05:01:00"));
  it("days", () => expect(at(3 * 86_400_000 + 2 * 3_600_000)).toBe("3d 02h 00m"));
});

describe("status", () => {
  it("is shown for timers and hidden for timestamps by default", () => {
    const timer = entity("timer.a", "paused", {
      duration: "0:01:00",
      remaining: "0:00:30",
    });
    expect(view(timer, {}).vm.texts.status).toBe("Paused");
    expect(view(hour, {}).vm.texts.status).toBeUndefined();
    expect(view(hour, { status: true }).vm.texts.status).toBe("Running");
  });

  it("labels can be replaced", () => {
    const timer = entity("timer.a", "paused", {
      duration: "0:01:00",
      remaining: "0:00:30",
    });
    expect(
      view(timer, { status: { labels: { paused: "Pause" } } }).vm.texts.status,
    ).toBe("Pause");
  });
});

describe("text areas", () => {
  it("placeholders are filled, unknown ones stay visible", () => {
    const vm = view(hour, {
      text: {
        title: "{name} · {attr:device_class}",
        subtitle: "bis {end_time} {oops}",
      },
    }).vm;
    expect(vm.texts.title).toBe("sensor.show · timestamp");
    expect(vm.texts.subtitle).toBe("bis 23:00 {oops}");
  });

  it("false hides an area", () => {
    const vm = view(hour, { text: { title: false, subtitle: false } }).vm;
    expect(vm.texts.title).toBeUndefined();
    expect(vm.texts.subtitle).toBeUndefined();
  });
});

describe("colors", () => {
  it("resolves Home Assistant colour names and bare variables", () => {
    expect(resolveColor("red")).toBe("var(--red-color)");
    expect(resolveColor("--my-accent")).toBe("var(--my-accent)");
    expect(resolveColor("#4CAF50")).toBe("#4CAF50");
    expect(resolveColor("")).toBeUndefined();
  });

  it("thresholds pick the highest one reached, and the lowest below all", () => {
    const t = [
      { value: 75, color: "#4CAF50" },
      { value: 40, color: "#FFC107" },
      { value: 0, color: "#F44336" },
    ];
    expect(pickThreshold(80, t)).toBe("#4CAF50");
    expect(pickThreshold(75, t)).toBe("#4CAF50");
    expect(pickThreshold(50, t)).toBe("#FFC107");
    expect(pickThreshold(10, t)).toBe("#F44336");
    expect(pickThreshold(-5, t)).toBe("#F44336");
  });

  it("thresholds on remaining seconds", () => {
    const cfg = {
      ...hourCfg,
      colors: {
        mode: "thresholds" as const,
        basis: "remaining_seconds" as const,
        thresholds: [
          { value: 60, color: "green" },
          { value: 0, color: "red" },
        ],
      },
    };
    expect(view(hour, cfg).vm.color).toBe("var(--green-color)");
    expect(view(hour, cfg, NOW + 3_570_000).vm.color).toBe("var(--red-color)");
  });

  it("gradient runs over the course of the countdown", () => {
    const cfg = {
      ...hourCfg,
      colors: { mode: "gradient" as const, start: "#00ff00", end: "#ff0000" },
    };
    expect(view(hour, cfg).vm.color).toBe("#00ff00");
    expect(view(hour, cfg, NOW + 1_800_000).vm.color).toBe(
      "color-mix(in oklch, #ff0000 50%, #00ff00)",
    );
    expect(view(hour, cfg, NOW + 3_600_000).vm.color).toBe("#ff0000");
  });

  it("mixColors clamps", () => {
    expect(mixColors("a", "b", -1)).toBe("a");
    expect(mixColors("a", "b", 2)).toBe("b");
  });
});

describe("animation effect", () => {
  it("finishing only in the last seconds", () => {
    const cfg = {
      ...hourCfg,
      animation: {
        effect: "pulse" as const,
        effect_when: "finishing" as const,
        finishing_seconds: 60,
      },
    };
    expect(view(hour, cfg).vm.effect).toBe("none");
    expect(view(hour, cfg, NOW + 3_550_000).vm.effect).toBe("pulse");
  });

  it("disabled animations disable every effect", () => {
    const cfg = {
      animation: {
        enabled: false,
        effect: "glow" as const,
        effect_when: "always" as const,
      },
    };
    expect(view(hour, cfg).vm.effect).toBe("none");
  });
});
