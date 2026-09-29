import { normalizeConfig } from "../src/core/config";
import { HIDDEN, fromForm, toForm } from "../src/editor/transform";
import { SCHEMA, type FormSchema } from "../src/editor/schema";
import type { UserCardConfig } from "../src/types";

/**
 * ha-form's binding rule, copied from frontend/src/components/ha-form/ha-form.ts:
 *   getValue = (obj, item) => !item.name || item.flatten ? obj : obj[item.name]
 * An expandable section without flatten reads and writes under data[name].
 * This stand-in applies it to set one field, the way a user edit would.
 */
function edit(data: Record<string, unknown>, path: string[], value: unknown) {
  const next = structuredClone(data);
  let target = next as Record<string, unknown>;
  for (const key of path.slice(0, -1)) {
    target[key] = { ...((target[key] as object) ?? {}) };
    target = target[key] as Record<string, unknown>;
  }
  target[path[path.length - 1]] = value;
  return next;
}

/** Every field path the form binds, resolved with ha-form's rule. */
function paths(schema: FormSchema[], prefix: string[] = []): string[][] {
  return schema.flatMap((item) =>
    item.type === "expandable"
      ? paths(item.schema ?? [], item.flatten ? prefix : [...prefix, item.name])
      : [[...prefix, item.name]],
  );
}

const base: UserCardConfig = {
  type: "custom:advanced-countdown-card",
  entity: "timer.coffee",
};

describe("editor transform", () => {
  it("an untouched form writes back exactly the config it was given", () => {
    expect(fromForm(toForm(base), base)).toEqual(base);
    const rich: UserCardConfig = {
      ...base,
      display: { type: "bar", thickness: 14 },
      text: { title: "Kaffee", percentage: false, subtitle: false },
      icon: false,
      colors: { mode: "thresholds", thresholds: [{ value: 0, color: "red" }] },
      status: { show: true, labels: { active: "Läuft" } },
    };
    expect(fromForm(toForm(rich), rich)).toEqual({
      ...rich,
      // percentage: false is the default and is not written back.
      text: { title: "Kaffee", subtitle: false },
      icon: { icon: false },
      status: { show: true, labels: { active: "Läuft" } },
    });
  });

  it("every field of the form reads a defined value", () => {
    const form = toForm(base);
    const unbound = paths(SCHEMA).filter((path) => {
      let value: unknown = form;
      for (const key of path)
        value = (value as Record<string, unknown> | undefined)?.[key];
      return value === undefined;
    });
    // These have no default on purpose: empty means "not set".
    const optional = [
      "entity",
      "source.attribute",
      "source.template",
      "progress.start",
      "progress.window",
      "progress.min",
      "progress.max",
      "on_complete.text",
      "on_complete.color",
      "on_complete.effect",
      "colors.primary",
      "colors.secondary",
      "colors.start",
      "colors.end",
      "colors.track",
      "colors.text",
      "appearance.background",
      "tap_action",
      "hold_action",
      "double_tap_action",
    ];
    expect(
      unbound.map((p) => p.join(".")).filter((p) => !optional.includes(p)),
    ).toEqual([]);
  });

  it("an edit lands at the nested key and nothing else is written", () => {
    const form = edit(toForm(base), ["display", "type"], "radial");
    expect(fromForm(form, base)).toEqual({ ...base, display: { type: "radial" } });
  });

  it("switching ring to donut does not pin the ring's thickness", () => {
    const form = edit(toForm(base), ["display", "style"], "donut");
    const out = fromForm(form, base);
    expect(out.display).toEqual({ style: "donut" });
    expect(normalizeConfig(out).display.thickness).toBe(16);
  });

  it("hidden text areas and show/hide switches round-trip to false/true", () => {
    let form = edit(toForm(base), ["text", "subtitle"], HIDDEN);
    form = edit(form, ["format", "show_seconds"], "hide");
    form = edit(form, ["status", "show"], "show");
    form = edit(form, ["icon", "visible"], false);
    const out = fromForm(form, base);
    expect(out).toMatchObject({
      text: { subtitle: false },
      format: { show_seconds: false },
      status: { show: true },
      icon: { icon: false },
    });
    expect(() => normalizeConfig(out)).not.toThrow();
  });

  it("YAML-only keys survive an edit", () => {
    const withMap: UserCardConfig = {
      ...base,
      source: { type: "numeric", map: { rinse: 70 } },
    };
    const out = fromForm(
      edit(toForm(withMap), ["display", "type"], "bar"),
      withMap,
    );
    expect(out.source).toEqual({ type: "numeric", map: { rinse: 70 } });
  });

  it("shorthands are shown in their long form", () => {
    const form = toForm({
      ...base,
      display: "bar",
      layout: "horizontal",
      icon: "mdi:coffee",
    });
    expect((form.display as Record<string, unknown>).type).toBe("bar");
    expect((form.layout as Record<string, unknown>).orientation).toBe("horizontal");
    expect((form.icon as Record<string, unknown>).icon).toBe("mdi:coffee");
  });

  it("actions stay top-level keys", () => {
    const form = edit(toForm(base), ["hold_action"], { action: "toggle" });
    expect(fromForm(form, base)).toEqual({
      ...base,
      hold_action: { action: "toggle" },
    });
  });
});
