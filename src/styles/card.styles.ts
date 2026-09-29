import { css } from "lit";

/**
 * Card tokens and layout.
 *
 * Surfaces and text follow the Home Assistant theme; the one colour the card
 * owns is the progress colour, --acc-color, which the engine sets per state
 * (static, threshold or gradient) and which everything else derives from:
 * the track is that colour at low strength, the icon badge and the digit
 * tiles likewise. A theme or card_mod can override any of the tokens below.
 *
 * Dark mode is keyed off the [dark] host attribute, set from
 * hass.themes.darkMode -- not off prefers-color-scheme. Home Assistant's dark
 * mode is a user setting independent of the operating system.
 *
 * Sizes come from container queries on the card's own width (cqi), never from
 * the viewport: the same card is narrow in a Mushroom-sized grid cell and wide
 * in a panel view on the same screen.
 */
export const cardStyles = css`
  :host {
    display: block;
    --acc-color: var(--primary-color, #03a9f4);
    --acc-text: var(--primary-text-color, #1c1c1c);
    --acc-muted: var(--secondary-text-color, #5f6368);
    --acc-surface: var(--ha-card-background, var(--card-background-color, #fff));
    --acc-track-strength: 16%;
    --acc-track: color-mix(
      in srgb,
      var(--acc-color) var(--acc-track-strength),
      transparent
    );
    --acc-speed: 1;
    --acc-progress-transition: calc(1s * var(--acc-speed)) linear;
    --acc-state-transition: calc(0.6s * var(--acc-speed)) cubic-bezier(0.2, 0, 0, 1);
    --acc-padding: 16px;
    --acc-gap: 12px;
    --acc-visual-scale: 1;
    --acc-icon-scale: 1;
  }

  :host([dark]) {
    --acc-track-strength: 22%;
  }

  * {
    box-sizing: border-box;
  }

  ha-card {
    height: 100%;
    overflow: hidden;
    container-type: inline-size;
    color: var(--acc-text);
    transition: box-shadow 0.2s ease;
  }

  ha-card.glass {
    background: color-mix(in srgb, var(--acc-surface) 58%, transparent);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    backdrop-filter: blur(16px) saturate(1.4);
    border: 1px solid color-mix(in srgb, var(--acc-text) 10%, transparent);
  }

  ha-card.actionable {
    cursor: pointer;
  }
  ha-card.actionable:focus-visible {
    outline: 2px solid var(--acc-color);
    outline-offset: 2px;
  }
  ha-card.pressed {
    transform: scale(0.985);
    transition: transform 0.12s ease;
  }

  .acc {
    height: 100%;
    padding: var(--acc-padding);
    display: flex;
    flex-direction: column;
    gap: var(--acc-gap);
    min-width: 0;
  }
  .acc.compact,
  .acc.minimal {
    --acc-padding: 12px;
    --acc-gap: 8px;
    --acc-visual-scale: 0.8;
  }
  .acc.align-center {
    align-items: center;
    text-align: center;
  }

  /* -- header ------------------------------------------------------------ */
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    width: 100%;
  }
  .align-center > .header,
  .align-center .column > .header {
    justify-content: center;
  }
  .header.icon-top {
    flex-direction: column;
    gap: 8px;
  }
  .titles {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .title {
    font-size: 1rem;
    font-weight: 500;
    line-height: 1.35;
    letter-spacing: 0.1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .subtitle {
    font-size: 0.8125rem;
    line-height: 1.35;
    color: var(--acc-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .header .value-inline {
    margin-inline-start: auto;
    font-size: 1.375rem;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }

  .icon-badge {
    --badge: calc(40px * var(--acc-icon-scale));
    flex: none;
    width: var(--badge);
    height: var(--badge);
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: var(--acc-icon-color, var(--acc-color));
    background: color-mix(
      in srgb,
      var(--acc-icon-color, var(--acc-color)) 18%,
      transparent
    );
    --mdc-icon-size: calc(22px * var(--acc-icon-scale));
    transition:
      color var(--acc-state-transition),
      background var(--acc-state-transition);
  }
  .compact .icon-badge {
    --badge: calc(32px * var(--acc-icon-scale));
    --mdc-icon-size: calc(18px * var(--acc-icon-scale));
  }

  /* -- visual ------------------------------------------------------------ */
  .visual {
    width: 100%;
    display: flex;
    justify-content: center;
    min-width: 0;
  }
  .visual.round {
    width: calc(clamp(96px, 58cqi, 260px) * var(--acc-visual-scale));
  }
  .visual.round.size-small {
    width: calc(clamp(72px, 40cqi, 160px) * var(--acc-visual-scale));
  }
  .visual.round.size-large {
    width: calc(clamp(120px, 78cqi, 360px) * var(--acc-visual-scale));
  }
  .align-start .visual.round {
    align-self: flex-start;
  }

  .value-line {
    font-size: clamp(1.5rem, 10cqi, 2.75rem);
    font-weight: 500;
    line-height: 1.1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .compact .value-line {
    font-size: clamp(1.25rem, 8cqi, 2rem);
  }

  .footer {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    min-height: 0;
  }
  .align-center .footer {
    justify-content: center;
  }
  .footer.spread {
    justify-content: space-between;
    width: 100%;
  }
  .percentage {
    font-size: 0.875rem;
    color: var(--acc-muted);
    font-variant-numeric: tabular-nums;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 10px 2px 8px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1.6;
    color: var(--acc-text);
    background: color-mix(in srgb, var(--acc-status-color) 14%, transparent);
    transition: background var(--acc-state-transition);
  }
  .status::before {
    content: "";
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--acc-status-color);
  }

  /* -- horizontal layouts -------------------------------------------------- */
  .acc.horizontal.side {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    column-gap: calc(var(--acc-gap) + 6px);
  }
  .acc.horizontal.side .visual.round {
    width: calc(clamp(72px, 32cqi, 150px) * var(--acc-visual-scale));
  }
  .acc.horizontal.side .visual.round.size-large {
    width: calc(clamp(96px, 42cqi, 200px) * var(--acc-visual-scale));
  }
  .acc.horizontal.side .visual.round.size-small {
    width: calc(clamp(56px, 22cqi, 110px) * var(--acc-visual-scale));
  }
  .column {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  /* Side by side, text always starts at the left: a centred subtitle under
     a left-aligned title reads as misplaced. */
  .acc.horizontal {
    text-align: start;
  }
  .acc.horizontal.side .header,
  .acc.horizontal.side .footer {
    justify-content: flex-start;
  }

  /* -- error --------------------------------------------------------------- */
  .notice {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .notice .icon-badge {
    --acc-icon-color: var(--warning-color, #ffa600);
  }
  .notice .message {
    font-size: 0.875rem;
    color: var(--acc-muted);
  }
  .notice .detail {
    font-size: 0.75rem;
    color: var(--acc-muted);
    font-family: var(--code-font-family, ui-monospace, monospace);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview-hidden {
    opacity: 0.45;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
`;
