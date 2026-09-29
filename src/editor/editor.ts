import { LitElement, css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { EDITOR_TAG } from "../const";
import type { HomeAssistant, UserCardConfig } from "../types";
import { defineOnce } from "../utils/define";
import { LABELS, SCHEMA, type FormSchema } from "./schema";
import { fromForm, toForm } from "./transform";

interface CardHelpers {
  createCardElement(config: { type: string; entities?: unknown[] }): HTMLElement;
}

declare global {
  interface Window {
    loadCardHelpers?: () => Promise<CardHelpers>;
  }
}

/**
 * ha-form is Home Assistant's own form element, lazily loaded by the frontend.
 * When this editor opens it is usually defined already, because the card
 * editor dialog uses it. If not, asking a built-in card for its editor loads
 * it. This is the workaround most custom cards use; it relies on frontend
 * internals and is the one part of the card not covered by a public API.
 */
async function ensureHaForm(): Promise<void> {
  if (customElements.get("ha-form")) return;
  try {
    const helpers = await window.loadCardHelpers?.();
    const card = helpers?.createCardElement({ type: "entities", entities: [] });
    const ctor = card?.constructor as
      { getConfigElement?: () => Promise<unknown> } | undefined;
    await ctor?.getConfigElement?.();
  } catch {
    // Nothing to do: without ha-form the YAML editor still works.
  }
}

export class AdvancedCountdownCardEditor extends LitElement {
  @state() private _config?: UserCardConfig;
  /** Lovelace assigns hass AFTER setConfig. As a plain field that assignment
   *  would not schedule a render and the form would stay blank. */
  @property({ attribute: false }) public hass?: HomeAssistant;

  public override connectedCallback(): void {
    super.connectedCallback();
    void ensureHaForm().then(() => this.requestUpdate());
  }

  public setConfig(config: UserCardConfig): void {
    this._config = config;
  }

  private readonly _computeLabel = (schema: FormSchema): string =>
    LABELS[schema.name] ?? schema.title ?? schema.name;

  private _valueChanged(event: CustomEvent): void {
    event.stopPropagation();
    if (!this._config) return;
    const value = (event.detail as { value: Record<string, unknown> }).value;
    const config = fromForm(value, this._config);
    this._config = config;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        bubbles: true,
        composed: true,
        detail: { config },
      }),
    );
  }

  protected override render() {
    if (!this._config || !this.hass) return nothing;
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${toForm(this._config)}
        .schema=${SCHEMA}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
      <p class="hint">
        Thresholds, status labels, value maps and entity-based start times are YAML
        only -- see the README.
      </p>
    `;
  }

  static override styles = css`
    ha-form {
      display: block;
    }
    .hint {
      margin: 12px 0 0;
      font-size: 0.8125rem;
      color: var(--secondary-text-color);
    }
  `;
}

defineOnce(EDITOR_TAG, AdvancedCountdownCardEditor);

declare global {
  interface HTMLElementTagNameMap {
    "advanced-countdown-card-editor": AdvancedCountdownCardEditor;
  }
}
