import { LitElement, html, nothing, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import "../sources";
import "../renderers";
import { CARD_TAG, EDITOR_TAG } from "../const";
import { ConfigError, normalizeConfig } from "../core/config";
import { evaluate, isTicking, type EngineEnv } from "../core/engine";
import { readSnapshot, watchedEntities } from "../core/pipeline";
import { getRenderer } from "../core/registry";
import { sharedTicker } from "../core/ticker";
import { animationStyles } from "../styles/animation.styles";
import { cardStyles } from "../styles/card.styles";
import { rendererStyles } from "../styles/renderer.styles";
import type {
  CardConfig,
  HomeAssistant,
  LovelaceGridOptions,
  Snapshot,
  UserCardConfig,
  ViewModel,
} from "../types";
import { hour12Setting } from "../utils/format";
import { translator } from "../utils/localize";
import { defineOnce } from "../utils/define";
import { GestureHandler, hasAction } from "./gestures";
import { renderLayout, renderNotice } from "./layout";
import { TemplateController } from "./template-controller";

let instances = 0;

/**
 * The card element. It owns three moments and keeps them apart:
 *
 *   hass changes     -> only if a watched entity changed: re-read the snapshot
 *   the ticker ticks -> re-evaluate the snapshot for "now"; render only if
 *                       something visible changed
 *   render           -> layout + renderer from the view model
 *
 * `hass` is replaced on every state change in the whole installation. It is
 * therefore not a reactive property: re-rendering on each of them is the most
 * common performance bug in custom cards.
 */
export class AdvancedCountdownCard extends LitElement {
  static override styles = [cardStyles, rendererStyles, animationStyles];

  /** Set by hui-card in the card editor's preview. */
  @property({ type: Boolean }) public preview = false;

  @state() private _vm?: ViewModel;
  @state() private _configError?: string;

  private _config?: CardConfig;
  private _hass?: HomeAssistant;
  private _snapshot?: Snapshot;
  private _signature = "";
  private _unsubscribeTick?: () => void;
  private _tickPhase?: number;
  private readonly _uid = `acc${++instances}`;
  private readonly _templates = new TemplateController(this, () =>
    this._refreshSnapshot(),
  );
  private readonly _gestures = new GestureHandler(() =>
    this._config
      ? {
          entity: this._config.entity,
          tap_action: this._config.tap_action,
          hold_action: this._config.hold_action,
          double_tap_action: this._config.double_tap_action,
        }
      : undefined,
  );

  /* -- Lovelace API ------------------------------------------------------ */

  public static async getConfigElement(): Promise<HTMLElement> {
    await import("../editor/editor");
    return document.createElement(EDITOR_TAG);
  }

  /** The first timer, else a timestamp sensor, else a battery: a card that
   *  shows something moving the moment it is added. */
  public static getStubConfig(
    hass: HomeAssistant,
    entities: string[] = [],
    fallback: string[] = [],
  ): UserCardConfig {
    const all = [...entities, ...fallback, ...Object.keys(hass?.states ?? {})];
    const pick =
      all.find((id) => id.startsWith("timer.")) ??
      all.find(
        (id) => hass?.states?.[id]?.attributes?.device_class === "timestamp",
      ) ??
      all.find(
        (id) => hass?.states?.[id]?.attributes?.device_class === "battery",
      ) ??
      "timer.example";
    return { type: `custom:${CARD_TAG}`, entity: pick };
  }

  public setConfig(config: UserCardConfig): void {
    try {
      this._config = normalizeConfig(config);
      this._configError = undefined;
    } catch (error) {
      this._config = undefined;
      this._configError =
        error instanceof ConfigError ? error.message : String(error);
      // Lovelace shows its error card for a throwing setConfig, which is the
      // right place for a config the user has to fix.
      throw error;
    }
    this._updateTemplate();
    this._refreshSnapshot();
  }

  public set hass(hass: HomeAssistant) {
    const previous = this._hass;
    this._hass = hass;
    this.toggleAttribute("dark", !!hass.themes?.darkMode);
    this._updateTemplate();
    if (!this._config) return;
    if (!previous || this._relevantChange(previous, hass, this._config)) {
      this._refreshSnapshot();
    }
  }

  public get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  public getCardSize(): number {
    const type = this._config?.display.type;
    if (type === "circle" || type === "radial") {
      return this._config?.layout.orientation === "horizontal" ? 2 : 4;
    }
    return 2;
  }

  public getGridOptions(): LovelaceGridOptions {
    // Half a section by default, like a pair of tile cards. A horizontal card
    // puts text beside the visual and needs the full section width.
    if (this._config?.layout.orientation === "horizontal") {
      return { columns: 12, rows: "auto", min_columns: 6 };
    }
    return { columns: 6, rows: "auto", min_columns: 3 };
  }

  /* -- lifecycle --------------------------------------------------------- */

  public override connectedCallback(): void {
    super.connectedCallback();
    this._syncTicker();
    if (this._snapshot) this._evaluate(Date.now());
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stopTicker();
    this._gestures.detach();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const card = this.renderRoot.querySelector("ha-card");
    if (card instanceof HTMLElement) this._gestures.attach(card);
  }

  /* -- data -------------------------------------------------------------- */

  private _relevantChange(
    previous: HomeAssistant,
    hass: HomeAssistant,
    config: CardConfig,
  ): boolean {
    if (previous.locale !== hass.locale || previous.language !== hass.language)
      return true;
    if (previous.config?.time_zone !== hass.config?.time_zone) return true;
    return watchedEntities(config).some(
      (id) => previous.states[id] !== hass.states[id],
    );
  }

  private _updateTemplate(): void {
    const config = this._config;
    const template =
      config?.source.type === "template" ? config.source.template : undefined;
    this._templates.update(this._hass, template, config?.entity);
  }

  private _refreshSnapshot(): void {
    const hass = this._hass;
    const config = this._config;
    if (!hass || !config) return;
    this._snapshot = readSnapshot(
      hass,
      config,
      Date.now(),
      this._templates.rendered,
    );
    if (config.debug) {
      console.debug(`[${CARD_TAG}] snapshot`, this._snapshot);
    }
    this._syncTicker();
    this._evaluate(Date.now());
  }

  private _env(): EngineEnv {
    const hass = this._hass;
    const language = hass?.locale?.language ?? hass?.language ?? "en";
    const serverZone = hass?.config?.time_zone;
    return {
      t: translator(language),
      locale: language,
      displayZone: hass?.locale?.time_zone === "server" ? serverZone : undefined,
      hour12: hour12Setting(hass?.locale?.time_format),
      entity: this._config?.entity ? hass?.states[this._config.entity] : undefined,
    };
  }

  private _evaluate(now: number): void {
    const snapshot = this._snapshot;
    const config = this._config;
    if (!snapshot || !config) return;
    const vm = evaluate(snapshot, config, now, this._env());
    // Only what can be seen goes into the signature. A 1-hour countdown moves
    // its ring by 0.03 % per second; a thousandth is below a pixel on any
    // ring a dashboard draws. Digits and a plain number draw no progress at
    // all, so for them only the text counts.
    const drawsProgress =
      config.display.type !== "numeric" && config.display.type !== "digital";
    const signature = JSON.stringify([
      vm.texts,
      vm.status,
      !drawsProgress || vm.progress === null
        ? null
        : Math.round(vm.progress * 1000),
      vm.color,
      vm.effect,
      vm.hidden,
      // The digit groups always carry seconds; only the digital tiles show them.
      config.display.type === "digital" ? vm.digits : null,
    ]);
    if (signature === this._signature) return;
    this._signature = signature;
    this._vm = vm;
    this._syncHidden(vm.hidden);
    if (config.debug) console.debug(`[${CARD_TAG}] view`, vm);
  }

  /** hui-card hides the whole grid slot when a card sets `hidden` and says
   *  so -- and still shows it in the editor preview. */
  private _syncHidden(hidden: boolean): void {
    if (this.hidden === hidden) return;
    this.hidden = hidden;
    this.dispatchEvent(
      new CustomEvent("card-visibility-changed", {
        bubbles: true,
        composed: true,
        detail: { value: !hidden },
      }),
    );
  }

  /* -- ticking ----------------------------------------------------------- */

  private _syncTicker(): void {
    const snapshot = this._snapshot;
    const config = this._config;
    const ticking =
      !!snapshot && !!config && this.isConnected && isTicking(snapshot, config);
    if (!ticking) {
      this._stopTicker();
      return;
    }
    // The display changes when the remaining time crosses a whole second,
    // which happens at the end time's millisecond within each second.
    const anchor =
      snapshot?.kind === "countdown"
        ? (snapshot.endMs ?? snapshot.finishedAtMs ?? 0)
        : 0;
    const phase = ((anchor % 1000) + 1000) % 1000;
    if (this._unsubscribeTick && this._tickPhase === phase) return;
    this._stopTicker();
    this._tickPhase = phase;
    this._unsubscribeTick = sharedTicker.subscribe((now) => {
      this._evaluate(now);
      // Past the end a countdown stops ticking unless it counts up.
      if (
        this._vm?.status === "finished" &&
        this._config?.on_complete.action !== "count_up"
      ) {
        this._stopTicker();
      }
    }, phase);
  }

  private _stopTicker(): void {
    this._unsubscribeTick?.();
    this._unsubscribeTick = undefined;
    this._tickPhase = undefined;
  }

  /* -- render ------------------------------------------------------------ */

  protected override render() {
    if (this._configError) {
      return html`<ha-card><div class="acc">${this._configError}</div></ha-card>`;
    }
    const config = this._config;
    const vm = this._vm;
    if (!config || !vm) return nothing;

    const actionable =
      hasAction(config.tap_action) ||
      hasAction(config.hold_action) ||
      hasAction(config.double_tap_action);
    const renderer = getRenderer(config.display.type);
    const entity = config.entity ? this._hass?.states[config.entity] : undefined;
    const classes = [
      config.appearance.glass ? "glass" : "",
      actionable ? "actionable" : "",
      vm.hidden && this.preview ? "preview-hidden" : "",
    ].join(" ");

    const body =
      vm.kind === "error" || !renderer
        ? renderNotice(vm)
        : renderLayout({ vm, config, renderer, entity, uid: this._uid });

    return html`
      <ha-card
        class=${classes}
        style=${config.appearance.background ? `--ha-card-background: ${config.appearance.background}` : ""}
        role=${actionable ? "button" : "group"}
        tabindex=${actionable ? "0" : "-1"}
        aria-label=${vm.ariaLabel}
      >
        ${body}
        <span class="sr-only" aria-live="polite">${this._liveText(vm)}</span>
      </ha-card>
    `;
  }

  /**
   * Announcing every second would make a screen reader unusable. The live
   * region carries only the status, so it speaks when the countdown starts,
   * pauses or finishes -- the moments that matter.
   */
  private _liveText(vm: ViewModel): string {
    const title = vm.texts.title ?? "";
    const status =
      this._config?.status.labels?.[vm.status] ?? this._env().t(vm.status);
    return vm.kind === "countdown" ? `${title} ${status}`.trim() : "";
  }
}

defineOnce(CARD_TAG, AdvancedCountdownCard, true);

declare global {
  interface HTMLElementTagNameMap {
    "advanced-countdown-card": AdvancedCountdownCard;
  }
}
