import { parseHmsDuration, parseSpan } from "../src/utils/duration";
import {
  nextTimeOfDay,
  parseIsoTimestamp,
  zoneOffsetMs,
} from "../src/utils/iso-time";

describe("parseIsoTimestamp", () => {
  it("reads UTC with Z", () => {
    expect(parseIsoTimestamp("2026-09-29T20:30:00Z")).toBe(
      Date.UTC(2026, 8, 29, 20, 30),
    );
  });

  it("reads an explicit offset as the same instant", () => {
    // The two examples from the specification are the same moment.
    expect(parseIsoTimestamp("2026-09-29T22:30:00+02:00")).toBe(
      parseIsoTimestamp("2026-09-29T20:30:00Z"),
    );
    expect(parseIsoTimestamp("2026-09-29T15:30:00-05:00")).toBe(
      Date.UTC(2026, 8, 29, 20, 30),
    );
    expect(parseIsoTimestamp("2026-09-29T20:30:00+0530")).toBe(
      Date.UTC(2026, 8, 29, 15, 0),
    );
  });

  it("keeps milliseconds and cuts microseconds, as Home Assistant writes them", () => {
    expect(parseIsoTimestamp("2026-09-29T20:30:00.123456+00:00")).toBe(
      Date.UTC(2026, 8, 29, 20, 30, 0, 123),
    );
    // 999999 µs is still second 00, never rounded into second 01.
    expect(parseIsoTimestamp("2026-09-29T20:30:00.999999+00:00")).toBe(
      Date.UTC(2026, 8, 29, 20, 30, 0, 999),
    );
  });

  it("reads a naive time in the given zone, not the browser's", () => {
    expect(parseIsoTimestamp("2026-09-29T22:30:00", "Europe/Berlin")).toBe(
      Date.UTC(2026, 8, 29, 20, 30),
    );
    expect(parseIsoTimestamp("2026-09-29 22:30:00", "America/New_York")).toBe(
      Date.UTC(2026, 8, 30, 2, 30),
    );
  });

  it("follows daylight saving time in the naive zone", () => {
    // Berlin: CET (+1) in January, CEST (+2) in July.
    expect(parseIsoTimestamp("2026-01-15T12:00:00", "Europe/Berlin")).toBe(
      Date.UTC(2026, 0, 15, 11),
    );
    expect(parseIsoTimestamp("2026-07-15T12:00:00", "Europe/Berlin")).toBe(
      Date.UTC(2026, 6, 15, 10),
    );
    // 2026-10-25 03:00 CEST -> 02:00 CET. 04:00 local is already CET.
    expect(parseIsoTimestamp("2026-10-25T04:00:00", "Europe/Berlin")).toBe(
      Date.UTC(2026, 9, 25, 3),
    );
  });

  it("reads a bare date as midnight in the zone", () => {
    expect(parseIsoTimestamp("2026-12-24", "Europe/Berlin")).toBe(
      Date.UTC(2026, 11, 23, 23),
    );
  });

  it.each([
    "",
    "tomorrow",
    "2026-13-01T00:00:00Z",
    "2026-02-30T00:00:00Z",
    "2026-09-29T25:00:00Z",
    "2026-09-29T20:61:00Z",
    "2026-09-29T20:30:00+25:00",
    "1727641800",
    "unknown",
  ])("rejects %j", (text) => {
    expect(parseIsoTimestamp(text, "UTC")).toBeUndefined();
  });

  it("rejects non-strings", () => {
    expect(parseIsoTimestamp(undefined)).toBeUndefined();
    expect(parseIsoTimestamp(123)).toBeUndefined();
  });
});

describe("zoneOffsetMs", () => {
  it("matches known offsets", () => {
    expect(zoneOffsetMs(Date.UTC(2026, 6, 1), "Europe/Berlin")).toBe(7_200_000);
    expect(zoneOffsetMs(Date.UTC(2026, 0, 1), "Europe/Berlin")).toBe(3_600_000);
    expect(zoneOffsetMs(Date.UTC(2026, 0, 1), "Asia/Kolkata")).toBe(19_800_000);
    expect(zoneOffsetMs(Date.UTC(2026, 0, 1), "UTC")).toBe(0);
  });
});

describe("nextTimeOfDay", () => {
  const now = Date.UTC(2026, 8, 29, 20, 0, 0); // 22:00 Berlin

  it("is later today when the time is still ahead", () => {
    expect(nextTimeOfDay("22:30", now, "Europe/Berlin")).toBe(
      Date.UTC(2026, 8, 29, 20, 30),
    );
  });

  it("is tomorrow when the time has passed", () => {
    expect(nextTimeOfDay("06:00:00", now, "Europe/Berlin")).toBe(
      Date.UTC(2026, 8, 30, 4, 0),
    );
  });

  it("rejects nonsense", () => {
    expect(nextTimeOfDay("25:00", now)).toBeUndefined();
    expect(nextTimeOfDay("soon", now)).toBeUndefined();
  });
});

describe("parseHmsDuration", () => {
  it.each([
    ["0:05:00", 300_000],
    ["1:00:00", 3_600_000],
    ["26:00:00", 93_600_000],
    ["0:00:07", 7000],
    ["05:30", 330_000],
    ["1 day, 2:00:00", 93_600_000],
    ["2 days, 0:00:01", 172_801_000],
  ])("%s -> %d ms", (text, ms) => {
    expect(parseHmsDuration(text)).toBe(ms);
  });

  it("rejects invalid values", () => {
    expect(parseHmsDuration("0:61:00")).toBeUndefined();
    expect(parseHmsDuration("five minutes")).toBeUndefined();
    expect(parseHmsDuration(undefined)).toBeUndefined();
  });
});

describe("parseSpan", () => {
  it.each([
    ["24h", 86_400_000],
    ["90m", 5_400_000],
    ["1d 2h 30m", 95_400_000],
    ["45s", 45_000],
    [3600, 3_600_000],
    ["3600", 3_600_000],
    ["1:30:00", 5_400_000],
  ])("%j", (value, ms) => {
    expect(parseSpan(value)).toBe(ms);
  });

  it("rejects empty or unknown units", () => {
    expect(parseSpan("")).toBeUndefined();
    expect(parseSpan("2w")).toBeUndefined();
    expect(parseSpan(0)).toBeUndefined();
    expect(parseSpan("0h")).toBeUndefined();
  });
});
