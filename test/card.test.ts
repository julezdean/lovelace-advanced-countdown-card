import "../src/card/card";
import type { AdvancedCountdownCard } from "../src/card/card";
import type { HomeAssistant } from "../src/types";
import { NOW, entity, hass } from "./helpers";

const iso = (ms: number) => new Date(ms).toISOString();

async function mount(config: Record<string, unknown>, h: HomeAssistant) {
  const card = document.createElement(
    "advanced-countdown-card",
  ) as AdvancedCountdownCard;
  card.setConfig({ type: "custom:advanced-countdown-card", ...config });
  card.hass = h;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

const text = (card: HTMLElement, selector: string) =>
  card.shadowRoot?.querySelector(selector)?.textContent?.trim();

describe("card element", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  const coffee = entity("timer.coffee", "active", {
    duration: "0:05:00",
    finishes_at: iso(NOW + 154_000),
    friendly_name: "Coffee",
  });

  it("renders the countdown and counts locally", async () => {
    const card = await mount({ entity: "timer.coffee" }, hass([coffee]));
    expect(text(card, ".inner-value")).toBe("02:34");
    // The end is on a whole second, so the ticks land at +1.005 s and +2.005 s.
    await vi.advanceTimersByTimeAsync(2010);
    await card.updateComplete;
    expect(text(card, ".inner-value")).toBe("02:32");
  });

  it("ignores hass updates for entities it does not watch", async () => {
    const other = entity("sensor.unrelated", "1");
    const h = hass([coffee, other]);
    const card = await mount({ entity: "timer.coffee", display: "numeric" }, h);
    const spy = vi.spyOn(
      card as unknown as { _refreshSnapshot: () => void },
      "_refreshSnapshot",
    );
    card.hass = {
      ...h,
      states: { ...h.states, "sensor.unrelated": entity("sensor.unrelated", "2") },
    };
    expect(spy).not.toHaveBeenCalled();
    card.hass = {
      ...h,
      states: { ...h.states, "timer.coffee": { ...coffee, state: "paused" } },
    };
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("stops ticking when detached and when the countdown is paused", async () => {
    const h = hass([coffee]);
    const card = await mount({ entity: "timer.coffee" }, h);
    const priv = card as unknown as { _unsubscribeTick?: () => void };
    expect(priv._unsubscribeTick).toBeDefined();
    card.remove();
    expect(priv._unsubscribeTick).toBeUndefined();
    document.body.append(card);
    expect(priv._unsubscribeTick).toBeDefined();
    card.hass = {
      ...h,
      states: {
        "timer.coffee": entity("timer.coffee", "paused", {
          duration: "0:05:00",
          remaining: "0:02:00",
        }),
      },
    };
    expect(priv._unsubscribeTick).toBeUndefined();
  });

  it("renders only when something visible changed", async () => {
    // A 2-hour timer shown as "2h 34m". The numbers in the README come from
    // this test: a bar moves 0.1 % about every 7 s; a plain number only when
    // the minute changes.
    const long = entity("timer.long", "active", {
      duration: "2:00:00",
      finishes_at: iso(NOW + 2 * 3_600_000 - 30_000),
    });
    const count = async (display: string) => {
      const card = await mount(
        { entity: "timer.long", display, format: "short" },
        hass([long]),
      );
      let renders = 0;
      const priv = card as unknown as { update: (c: unknown) => void };
      const update = priv.update.bind(card);
      priv.update = (c) => {
        renders++;
        update(c);
      };
      await vi.advanceTimersByTimeAsync(60_000);
      card.remove();
      return renders;
    };
    const bar = await count("bar");
    const numeric = await count("numeric");
    expect(bar).toBeGreaterThanOrEqual(7);
    expect(bar).toBeLessThanOrEqual(10);
    expect(numeric).toBe(1);
  });

  it("hides itself on completion and tells hui-card", async () => {
    const done = entity("timer.tea", "idle", {
      duration: "0:04:00",
      last_transition: "finished",
    });
    const h = hass([done]);
    const card = await mount({ entity: "timer.tea", on_complete: "hide" }, h);
    // hui-card reads the property after setting hass (hui-card.ts,
    // _updateVisibility), so the first state needs no event...
    expect(card.hidden).toBe(true);
    // ...and a later change is announced on the element, where hui-card listens.
    const events: boolean[] = [];
    card.addEventListener("card-visibility-changed", (e) =>
      events.push((e as CustomEvent).detail.value),
    );
    card.hass = {
      ...h,
      states: {
        "timer.tea": entity("timer.tea", "active", {
          duration: "0:04:00",
          finishes_at: iso(NOW + 60_000),
        }),
      },
    };
    expect(card.hidden).toBe(false);
    expect(events).toEqual([true]);
  });

  it("shows data errors in the card instead of throwing", async () => {
    const card = await mount({ entity: "sensor.gone" }, hass([]));
    expect(text(card, ".message")).toBe("Entity not found");
  });

  it("throws for a config the user has to fix", () => {
    const card = document.createElement(
      "advanced-countdown-card",
    ) as AdvancedCountdownCard;
    expect(() =>
      card.setConfig({ type: "x", entity: "timer.a", display: "pie" as never }),
    ).toThrow(/display.type/);
    expect(() => card.setConfig({ type: "x" })).toThrow(/entity/);
  });

  it("fires hass-action for a tap, with the card's own config", async () => {
    const card = await mount({ entity: "timer.coffee" }, hass([coffee]));
    const seen: unknown[] = [];
    card.addEventListener("hass-action", (e) =>
      seen.push((e as CustomEvent).detail),
    );
    const haCard = card.shadowRoot!.querySelector("ha-card")!;
    haCard.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(seen).toEqual([
      {
        action: "tap",
        config: {
          entity: "timer.coffee",
          tap_action: { action: "more-info" },
          hold_action: { action: "none" },
          double_tap_action: { action: "none" },
        },
      },
    ]);
  });

  it("stub config prefers a timer", () => {
    const Card = customElements.get("advanced-countdown-card") as unknown as {
      getStubConfig: (h: HomeAssistant) => { entity: string };
    };
    const h = hass([entity("sensor.b", "5", { device_class: "battery" }), coffee]);
    expect(Card.getStubConfig(h).entity).toBe("timer.coffee");
  });
});

describe("template subscription", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function connection() {
    const calls: { message: Record<string, unknown>; unsubscribed: boolean }[] = [];
    let resolve: (() => void) | undefined;
    const callbacks: ((msg: unknown) => void)[] = [];
    const conn = {
      subscribeMessage: (
        cb: (msg: unknown) => void,
        message: Record<string, unknown>,
      ) => {
        const call = { message, unsubscribed: false };
        calls.push(call);
        callbacks.push(cb);
        return new Promise<() => Promise<void>>((r) => {
          resolve = () =>
            r(async () => {
              call.unsubscribed = true;
            });
        });
      },
    };
    return { conn, calls, callbacks, resolve: () => resolve?.() };
  }

  it("subscribes once, renders the result, and closes on removal", async () => {
    const { conn, calls, callbacks, resolve } = connection();
    const h = {
      ...hass([]),
      connection: conn as unknown as HomeAssistant["connection"],
    };
    const card = await mount(
      { source: { type: "template", template: "{{ 42 }}" }, display: "numeric" },
      h,
    );
    expect(calls.length).toBe(1);
    expect(calls[0].message).toMatchObject({
      type: "render_template",
      template: "{{ 42 }}",
      report_errors: true,
    });
    resolve();
    await Promise.resolve();
    callbacks[0]({ result: 42, listeners: {} });
    await card.updateComplete;
    expect(text(card, ".numeric")).toBe("42");

    // hass replaced on an unrelated change: no new subscription.
    card.hass = { ...h, states: {} };
    expect(calls.length).toBe(1);

    card.remove();
    await Promise.resolve();
    expect(calls[0].unsubscribed).toBe(true);
  });

  it("closes a subscription that resolves after the card was removed", async () => {
    const { conn, calls, resolve } = connection();
    const h = {
      ...hass([]),
      connection: conn as unknown as HomeAssistant["connection"],
    };
    const card = await mount(
      { source: { type: "template", template: "{{ 1 }}" } },
      h,
    );
    card.remove();
    resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls[0].unsubscribed).toBe(true);
  });

  it("shows a template error", async () => {
    const conn = {
      subscribeMessage: () =>
        Promise.reject({ code: "template_error", message: "unexpected '}'" }),
    };
    const h = {
      ...hass([]),
      connection: conn as unknown as HomeAssistant["connection"],
    };
    const card = await mount({ source: { type: "template", template: "{{ }" } }, h);
    await new Promise((r) => setTimeout(r, 0));
    await card.updateComplete;
    expect(text(card, ".message")).toBe("Template error");
    expect(text(card, ".detail")).toBe("unexpected '}'");
  });
});
