import { Ticker } from "../src/core/ticker";

describe("Ticker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 8, 29, 20, 0, 0, 300)));
  });
  afterEach(() => vi.useRealTimers());

  it("fires at the listener's phase within each second", () => {
    const ticker = new Ticker(() => Date.now(), undefined);
    const seen: number[] = [];
    ticker.subscribe((now) => seen.push(now % 1000), 600);
    // From .300: .605, 1.605 and 2.605 all fall inside 2.5 s.
    vi.advanceTimersByTime(2500);
    expect(seen.length).toBe(3);
    // Just after .600, never before it.
    for (const ms of seen) expect(ms).toBeGreaterThanOrEqual(600);
    for (const ms of seen) expect(ms).toBeLessThan(620);
  });

  it("one timer for many listeners, gone when the last one leaves", () => {
    const ticker = new Ticker(() => Date.now(), undefined);
    const offs = Array.from({ length: 10 }, () =>
      ticker.subscribe(() => undefined, 0),
    );
    expect(ticker.size).toBe(10);
    expect(vi.getTimerCount()).toBe(1);
    offs.forEach((off) => off());
    expect(ticker.running).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a throwing listener does not stop the others", () => {
    const ticker = new Ticker(() => Date.now(), undefined);
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let calls = 0;
    ticker.subscribe(() => {
      throw new Error("boom");
    });
    ticker.subscribe(() => calls++);
    vi.advanceTimersByTime(3000);
    expect(calls).toBe(3);
    spy.mockRestore();
  });

  it("stops while the document is hidden and catches up when visible", () => {
    let state: DocumentVisibilityState = "visible";
    const target = new EventTarget();
    // defineProperty, not Object.assign: assign would read the getter once.
    Object.defineProperty(target, "visibilityState", { get: () => state });
    const doc = target as unknown as Document;
    const ticker = new Ticker(() => Date.now(), doc);
    let calls = 0;
    ticker.subscribe(() => calls++);

    state = "hidden";
    target.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(5000);
    expect(calls).toBe(0);

    state = "visible";
    target.dispatchEvent(new Event("visibilitychange"));
    expect(calls).toBe(1);
  });
});
