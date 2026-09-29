import { html } from "lit";
import { keyed } from "lit/directives/keyed.js";
import type { RendererDefinition } from "../core/registry";

/** Only the number, as large as the card allows. */
export const numericRenderer: RendererDefinition = {
  type: "numeric",
  hasInner: false,
  render({ vm, config }) {
    const animation = config.animation.enabled ? config.animation.digits : "none";
    const text = vm.texts.value ?? "";
    return html`<div class="numeric anim-${animation}" part="visual">
      ${animation === "none" ? text : keyed(text, html`<span class="digits">${text}</span>`)}
    </div>`;
  },
};
