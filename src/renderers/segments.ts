import { html } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import type { RendererDefinition } from "../core/registry";
import { resolveColor, mixColors } from "../utils/colors";
import { clipFor } from "./bar";

/**
 * The bar in N steps. The segment the progress is in is filled partially, so
 * the display moves every tick instead of jumping one segment at a time --
 * a 12-segment countdown over an hour would otherwise sit still for five
 * minutes and read as frozen. Its moving edge is cut straight: a rounded cut
 * inside a rounded segment leaves a crescent that reads as a rendering fault.
 */
export function segmentFills(fraction: number, count: number): number[] {
  const scaled = Math.min(1, Math.max(0, fraction)) * count;
  return Array.from({ length: count }, (_, i) =>
    Math.min(1, Math.max(0, scaled - i)),
  );
}

export const segmentsRenderer: RendererDefinition = {
  type: "segments",
  hasInner: false,
  render({ vm, config }) {
    const { thickness, rounded, segments, gradient, orientation } = config.display;
    const vertical = orientation === "vertical";
    const secondary = resolveColor(config.colors.secondary);
    const fills = segmentFills(vm.progress ?? 1, segments);

    return html`
      <div
        class="segments ${vertical ? "vertical" : "horizontal"}"
        part="visual"
        style=${styleMap({
          "--acc-bar-size": `${thickness}px`,
          "--acc-bar-radius": rounded ? `${Math.min(thickness / 2, 6)}px` : "1px",
        })}
      >
        ${fills.map((fill, i) => {
          const color =
            gradient && secondary
              ? mixColors(
                  "var(--acc-color)",
                  secondary,
                  segments > 1 ? i / (segments - 1) : 0,
                )
              : "var(--acc-color)";
          return html`<div class="segment">
            <div
              class="segment-fill ${vm.progress === null ? "indeterminate" : ""}"
              style=${styleMap({ background: color, clipPath: clipFor(fill, vertical, false) })}
            ></div>
          </div>`;
        })}
      </div>
    `;
  },
};
