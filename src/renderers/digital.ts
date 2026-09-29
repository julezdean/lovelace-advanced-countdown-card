import { html, nothing } from "lit";
import { keyed } from "lit/directives/keyed.js";
import type { RendererDefinition } from "../core/registry";

/**
 * Digit groups in tiles: 02 : 34 : 17.
 *
 * Each group is keyed by its value, so Lit replaces exactly the tiles whose
 * number changed and the CSS enter animation (flip or fade) runs on those and
 * nowhere else. There is no JavaScript animation and no timer here: the ticker
 * changes the value, the DOM swap does the rest.
 *
 * Tabular figures keep every tile the same width, so "11" and "00" do not make
 * the row twitch.
 */
export const digitalRenderer: RendererDefinition = {
  type: "digital",
  hasInner: false,
  render({ vm, config }) {
    const groups = vm.digits;
    const animation = config.animation.enabled ? config.animation.digits : "none";
    if (!groups?.length) {
      return html`<div class="digital text-only" part="visual">
        ${vm.texts.value ?? ""}
      </div>`;
    }
    const sign = vm.remainingMs !== undefined && vm.remainingMs < 0 ? "+" : "";
    return html`
      <div class="digital anim-${animation}" part="visual">
        ${sign ? html`<span class="sign">${sign}</span>` : nothing}
        ${groups.map(
          (group, i) =>
            html`${i > 0 ? html`<span class="colon">:</span>` : nothing}
              <span class="tile"
                >${keyed(`${i}:${group}`, html`<span class="digits">${group}</span>`)}</span
              >`,
        )}
        ${
          vm.kind === "value" && vm.texts.value?.endsWith("%")
            ? html`<span class="unit">%</span>`
            : nothing
        }
      </div>
    `;
  },
};
