import { css } from "lit";

/**
 * The visualisations. SVG strokes and clip-paths transition with the tick
 * (1 s, linear) so a running countdown moves continuously instead of
 * stepping, without a single requestAnimationFrame.
 */
export const rendererStyles = css`
  /* -- ring and gauge ----------------------------------------------------- */
  .ring,
  .gauge {
    position: relative;
    width: 100%;
    container-type: inline-size;
  }
  .ring {
    aspect-ratio: 1;
  }
  .ring svg,
  .gauge svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .track {
    fill: none;
    stroke: var(--acc-track-color, var(--acc-track));
    transition: stroke var(--acc-state-transition);
  }
  .fill {
    fill: none;
    transition:
      stroke-dashoffset var(--acc-progress-transition),
      stroke var(--acc-state-transition),
      opacity 0.2s ease;
  }
  .fill.indeterminate {
    opacity: 0.4;
  }
  .fill.empty {
    opacity: 0;
  }
  .tick {
    stroke: var(--acc-muted);
    stroke-width: 0.8;
    stroke-linecap: round;
    opacity: 0.35;
  }
  .tip {
    fill: var(--acc-surface);
    stroke: var(--acc-color);
    stroke-width: 1.6;
    transition:
      cx var(--acc-progress-transition),
      cy var(--acc-progress-transition);
  }
  .inner {
    position: absolute;
    inset: 0 0 auto 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    pointer-events: none;
  }
  .inner-value {
    font-size: min(20cqi, calc(118cqi / var(--acc-chars, 5)));
    font-weight: 500;
    line-height: 1.05;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .inner-sub {
    margin-top: 2cqi;
    font-size: clamp(0.6875rem, 8cqi, 1rem);
    color: var(--acc-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .inner-icon {
    --mdc-icon-size: 34cqi;
    color: var(--acc-icon-color, var(--acc-color));
  }
  .inner-icon.small {
    --mdc-icon-size: 12cqi;
    margin-bottom: 1cqi;
  }

  /* -- bar and segments --------------------------------------------------- */
  .bar,
  .segment {
    position: relative;
    border-radius: var(--acc-bar-radius);
    background: var(--acc-track-color, var(--acc-track));
    overflow: hidden;
    transition: background var(--acc-state-transition);
  }
  .bar.no-track {
    background: transparent;
  }
  .bar.horizontal {
    width: 100%;
    height: var(--acc-bar-size);
  }
  .bar.vertical,
  .segments.vertical {
    width: var(--acc-bar-size);
    height: clamp(80px, 36cqi, 200px);
  }
  .bar-fill,
  .segment-fill {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    transition:
      clip-path var(--acc-progress-transition),
      background var(--acc-state-transition);
  }
  .bar-fill.indeterminate,
  .segment-fill.indeterminate {
    opacity: 0.4;
  }
  .segments {
    display: flex;
    gap: max(3px, 0.8cqi);
    width: 100%;
  }
  .segments.horizontal .segment {
    flex: 1;
    height: var(--acc-bar-size);
  }
  .segments.vertical {
    flex-direction: column-reverse;
  }
  .segments.vertical .segment {
    flex: 1;
  }

  /* -- digits ------------------------------------------------------------- */
  .digital {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.12em;
    font-size: clamp(1.5rem, calc(96cqi / var(--acc-chars, 8)), 3.25rem);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .digital .tile {
    display: inline-block;
    padding: 0.1em 0.14em;
    border-radius: 0.16em;
    background: color-mix(in srgb, var(--acc-color) 13%, transparent);
    box-shadow: inset 0 -0.04em 0
      color-mix(in srgb, var(--acc-color) 18%, transparent);
    overflow: hidden;
    perspective: 4em;
    transition: background var(--acc-state-transition);
  }
  .digital .digits {
    display: inline-block;
  }
  .digital .colon {
    color: var(--acc-muted);
    font-weight: 400;
    transform: translateY(-0.06em);
  }
  .digital .sign,
  .digital .unit {
    color: var(--acc-muted);
    font-weight: 400;
  }
  .digital.text-only {
    font-size: clamp(1.25rem, 8cqi, 2.5rem);
  }

  .numeric {
    font-size: clamp(2rem, calc(150cqi / var(--acc-chars, 5)), 5.5rem);
    font-weight: 500;
    line-height: 1;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
  }
  .numeric .digits {
    display: inline-block;
  }
`;
