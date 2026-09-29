import { formatDuration, splitDuration } from "../src/utils/format";
import { config } from "./helpers";

const fmt = (ms: number, format: Record<string, unknown> = {}, locale = "en") =>
  formatDuration(ms, config({ entity: "timer.x", format }).format, locale).text;

const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;

describe("countdown formatting", () => {
  it("seconds", () => {
    expect(fmt(7 * S)).toBe("00:07");
    expect(fmt(7 * S, { style: "SS" })).toBe("07");
  });

  it("rounds up to the visible second, so 00:00 means done", () => {
    expect(fmt(6.2 * S)).toBe("00:07");
    expect(fmt(0.4 * S)).toBe("00:01");
    expect(fmt(0)).toBe("00:00");
  });

  it("minutes", () => {
    expect(fmt(2 * M + 34 * S)).toBe("02:34");
    expect(fmt(59 * M + 59 * S)).toBe("59:59");
  });

  it("hours", () => {
    expect(fmt(2 * H + 34 * M + 17 * S)).toBe("02:34:17");
    // Rounding up across the hour boundary keeps the hour.
    expect(fmt(59 * M + 59.5 * S)).toBe("01:00:00");
  });

  it("days switch to units instead of 52:12:00:00", () => {
    expect(fmt(2 * D + 4 * H + 12 * M)).toBe("2d 04h 12m");
  });

  it("the largest unit of a pattern absorbs everything above it", () => {
    expect(fmt(2 * H + 5 * M, { style: "MM:SS" })).toBe("125:00");
    expect(fmt(52 * H, { style: "HH:MM:SS" })).toBe("52:00:00");
    expect(fmt(2 * D + 4 * H, { style: "DD:HH:MM:SS" })).toBe("02:04:00:00");
  });

  it("short keeps the largest units and rounds at the last one shown", () => {
    expect(fmt(2 * H + 33 * M + 10 * S, { style: "short" })).toBe("2h 34m");
    expect(fmt(2 * H + 33 * M + 10 * S, { style: "short", largest_units: 3 })).toBe(
      "2h 33m 10s",
    );
    expect(fmt(45 * S, { style: "short" })).toBe("45s");
  });

  it("long uses the locale's own unit names", () => {
    expect(fmt(2 * H + 34 * M, { style: "long" }, "de")).toBe(
      "2 Stunden, 34 Minuten",
    );
    expect(fmt(2 * H + 34 * M, { style: "long" }, "en")).toBe(
      "2 hours, 34 minutes",
    );
    expect(fmt(1 * H, { style: "long" }, "en")).toBe("1 hour");
  });

  it("show_* removes or adds units", () => {
    expect(
      fmt(2 * H + 34 * M + 17 * S, { style: "HH:MM:SS", show_seconds: false }),
    ).toBe("02:35");
    expect(fmt(34 * M + 17 * S, { show_hours: true })).toBe("00:34:17");
  });
});

describe("splitDuration", () => {
  it("rounds down for elapsed time", () => {
    expect(splitDuration(61.9 * S, ["m", "s"], "down")).toMatchObject({
      m: 1,
      s: 1,
    });
    expect(splitDuration(61.9 * S, ["m", "s"], "up")).toMatchObject({ m: 1, s: 2 });
  });
});
