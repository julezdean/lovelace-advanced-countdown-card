import { css } from "lit";

/**
 * Effects are CSS only and restrained on purpose: a scale of 3.5 %, a glow
 * that stays inside the card, an opacity swing that never goes below 55 %.
 * A countdown on a wall tablet is looked at for seconds, not studied, and a
 * loud effect on ten cards at once is a light show.
 *
 * `prefers-reduced-motion: reduce` switches every animation and transition
 * off -- not slower, off. The value still updates; it just does not move.
 */
export const animationStyles = css`
  .visual.effect-pulse > * {
    animation: acc-pulse calc(1.6s * var(--acc-speed)) ease-in-out infinite;
  }
  .visual.effect-glow > * {
    animation: acc-glow calc(2s * var(--acc-speed)) ease-in-out infinite;
  }
  .visual.effect-breathing > * {
    animation: acc-breathe calc(3.2s * var(--acc-speed)) ease-in-out infinite;
  }
  .effect-rotate .icon-badge ha-icon,
  .effect-rotate .icon-badge ha-state-icon,
  .effect-rotate .inner-icon {
    animation: acc-spin calc(2.4s * var(--acc-speed)) linear infinite;
  }

  @keyframes acc-pulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.035);
    }
  }
  @keyframes acc-glow {
    0%,
    100% {
      filter: drop-shadow(0 0 0 transparent);
    }
    50% {
      filter: drop-shadow(
        0 0 8px color-mix(in srgb, var(--acc-color) 55%, transparent)
      );
    }
  }
  @keyframes acc-breathe {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.55;
    }
  }
  @keyframes acc-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Digit changes. The keyed tile is new in the DOM, so its enter animation
     runs exactly once, on exactly the digits that changed. */
  .anim-flip .digits {
    animation: acc-flip calc(0.42s * var(--acc-speed))
      cubic-bezier(0.3, 0.7, 0.4, 1);
    transform-origin: 50% 0;
    backface-visibility: hidden;
  }
  .anim-fade .digits {
    animation: acc-fade calc(0.35s * var(--acc-speed)) ease-out;
  }
  @keyframes acc-flip {
    from {
      transform: rotateX(80deg);
      opacity: 0.2;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }
  @keyframes acc-fade {
    from {
      transform: translateY(-18%);
      opacity: 0;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }

  /* progress: tick -- no interpolation between seconds. none -- nothing moves. */
  .acc.progress-tick {
    --acc-progress-transition: 0s;
  }
  .acc.progress-none {
    --acc-progress-transition: 0s;
    --acc-state-transition: 0s;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
    }
  }
`;
