import { html, nothing, svg } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import type { RendererDefinition } from "../core/registry";
import { resolveColor } from "../utils/colors";
import { circumference, dashOffset } from "./svg-arc";

/**
 * A full ring. circumference = 2πr, offset = circumference × (1 − progress).
 *
 * The ring starts at twelve o'clock and fills clockwise. The stroke is drawn
 * inside a 100×100 viewBox, so thickness is in percent of the diameter and the
 * ring scales with its container without a single pixel value.
 *
 * Without a known progress (a timestamp with no start) the ring is drawn full
 * and slightly muted: the countdown still counts, the ring just has nothing to
 * measure against. Inventing a start would draw a proportion that is not true.
 */
export const circleRenderer: RendererDefinition = {
  type: "circle",
  hasInner: true,
  render({ vm, config, inner, uid }) {
    const { thickness, rounded, track, gradient } = config.display;
    const r = 50 - thickness / 2 - 1;
    const length = circumference(r);
    const fraction = vm.progress ?? 1;
    const gradientId = `${uid}-ring`;
    const secondary = resolveColor(config.colors.secondary);
    const stroke =
      gradient && secondary ? `url(#${gradientId})` : "var(--acc-color)";

    return html`
      <div class="ring" part="visual">
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          ${
            gradient && secondary
              ? svg`<defs>
                <linearGradient id=${gradientId} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" style="stop-color: var(--acc-color)"></stop>
                  <stop offset="1" style="stop-color: ${secondary}"></stop>
                </linearGradient>
              </defs>`
              : nothing
          }
          ${
            track
              ? svg`<circle class="track" cx="50" cy="50" r=${r} stroke-width=${thickness}></circle>`
              : nothing
          }
          <circle
            class="fill ${vm.progress === null ? "indeterminate" : ""} ${fraction <= 0.0005 ? "empty" : ""}"
            cx="50"
            cy="50"
            r=${r}
            stroke-width=${thickness}
            stroke-linecap=${rounded ? "round" : "butt"}
            style=${styleMap({
              stroke,
              strokeDasharray: `${length}`,
              strokeDashoffset: `${dashOffset(length, fraction)}`,
            })}
            transform="rotate(-90 50 50)"
          ></circle>
        </svg>
        ${inner ? html`<div class="inner">${inner}</div>` : nothing}
      </div>
    `;
  },
};
