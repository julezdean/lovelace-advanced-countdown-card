import { html, nothing, svg } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import type { RendererDefinition } from "../core/registry";
import { resolveColor } from "../utils/colors";
import { arcBottom, arcLength, arcPath, dashOffset, polar } from "./svg-arc";

/**
 * A gauge: an open arc (270° by default) with its gap at six o'clock, scale
 * ticks inside it and a marker at the tip. It differs from the ring in what it
 * says -- a ring is a quantity going round, a gauge is a needle on a scale --
 * which is why it has ticks and the ring does not.
 *
 * The viewBox is cut just below the arc's ends, so a 270° gauge does not carry
 * a band of empty space under it.
 */
const TICKS = 10;

export const radialRenderer: RendererDefinition = {
  type: "radial",
  hasInner: true,
  render({ vm, config, inner, uid }) {
    const { thickness, rounded, track, gradient, arc } = config.display;
    const r = 50 - thickness / 2 - 2;
    const opening = 360 - arc;
    const start = 180 + opening / 2;
    const path = arcPath(50, 50, r, start, arc);
    const length = arcLength(r, arc);
    const fraction = vm.progress ?? 1;
    const bottom = Math.min(
      100,
      Math.ceil(arcBottom(50, r, opening, thickness) + 2),
    );
    const [tipX, tipY] = polar(50, 50, r, start + arc * fraction);
    const gradientId = `${uid}-arc`;
    const secondary = resolveColor(config.colors.secondary);
    const stroke =
      gradient && secondary ? `url(#${gradientId})` : "var(--acc-color)";
    const tickR1 = r - thickness / 2 - 3;
    const tickR2 = tickR1 - 2.5;

    const ticks = [];
    for (let i = 0; i <= TICKS; i++) {
      const deg = start + (arc * i) / TICKS;
      const [x1, y1] = polar(50, 50, tickR1, deg);
      const [x2, y2] = polar(50, 50, tickR2, deg);
      ticks.push(
        svg`<line class="tick" x1=${x1} y1=${y1} x2=${x2} y2=${y2}></line>`,
      );
    }

    return html`
      <div class="gauge" part="visual" style="aspect-ratio: 100 / ${bottom}">
        <svg viewBox="0 0 100 ${bottom}" aria-hidden="true" focusable="false">
          ${
            gradient && secondary
              ? svg`<defs>
                <linearGradient id=${gradientId} x1="0" y1="1" x2="1" y2="1">
                  <stop offset="0" style="stop-color: var(--acc-color)"></stop>
                  <stop offset="1" style="stop-color: ${secondary}"></stop>
                </linearGradient>
              </defs>`
              : nothing
          }
          ${
            track
              ? svg`<path class="track" d=${path} stroke-width=${thickness}
                stroke-linecap=${rounded ? "round" : "butt"}></path>`
              : nothing
          }
          ${ticks}
          <path
            class="fill ${vm.progress === null ? "indeterminate" : ""} ${fraction <= 0.0005 ? "empty" : ""}"
            d=${path}
            stroke-width=${thickness}
            stroke-linecap=${rounded ? "round" : "butt"}
            style=${styleMap({
              stroke,
              strokeDasharray: `${length}`,
              strokeDashoffset: `${dashOffset(length, fraction)}`,
            })}
          ></path>
          ${
            vm.progress === null
              ? nothing
              : svg`<circle class="tip" cx=${tipX} cy=${tipY} r=${thickness / 2 + 1.2}></circle>`
          }
        </svg>
        ${inner ? html`<div class="inner" style="height: ${(100 / bottom) * 100}%">${inner}</div>` : nothing}
      </div>
    `;
  },
};
