import { html } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import type { RendererDefinition } from "../core/registry";
import { resolveColor } from "../utils/colors";

/**
 * A horizontal or vertical bar.
 *
 * The fill is clipped rather than scaled or resized. Scaling squashes a
 * gradient and the rounded end with it; resizing re-lays out on every tick.
 * clip-path: inset() keeps the gradient fixed to the track -- the colour at a
 * point means the same all the way -- and transitions smoothly.
 */
export function clipFor(fraction: number, vertical: boolean, round = true): string {
  const hidden = `${Math.round((1 - Math.min(1, Math.max(0, fraction))) * 10000) / 100}%`;
  // `round` gives the moving edge the bar's own radius, so the fill ends in a
  // pill shape. The outer corners come from the track's overflow: hidden.
  const radius = round ? " round var(--acc-bar-radius)" : "";
  return vertical
    ? `inset(${hidden} 0 0 0${radius})`
    : `inset(0 ${hidden} 0 0${radius})`;
}

export const barRenderer: RendererDefinition = {
  type: "bar",
  hasInner: false,
  render({ vm, config }) {
    const { thickness, rounded, track, gradient, orientation } = config.display;
    const vertical = orientation === "vertical";
    const secondary = resolveColor(config.colors.secondary);
    const fraction = vm.progress ?? 1;
    const background =
      gradient && secondary
        ? `linear-gradient(${vertical ? "0deg" : "90deg"}, var(--acc-color), ${secondary})`
        : "var(--acc-color)";

    return html`
      <div
        class="bar ${vertical ? "vertical" : "horizontal"} ${track ? "" : "no-track"}"
        part="visual"
        style=${styleMap({
          "--acc-bar-size": `${thickness}px`,
          "--acc-bar-radius": rounded ? `${thickness / 2}px` : "2px",
        })}
      >
        <div
          class="bar-fill ${vm.progress === null ? "indeterminate" : ""}"
          style=${styleMap({ background, clipPath: clipFor(fraction, vertical) })}
        ></div>
      </div>
    `;
  },
};
