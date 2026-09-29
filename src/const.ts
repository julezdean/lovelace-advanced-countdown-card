/**
 * The card's tag and version come from the build, which reads them out of
 * package.json. Renaming the card therefore means changing "name" there.
 *
 * CSS custom properties use the short prefix --acc- rather than the full name:
 * it keeps every stylesheet readable and `type: custom:...` is long enough.
 */
declare const __CARD_VERSION__: string;
declare const __CARD_NAME__: string;

export const CARD_TAG = __CARD_NAME__;
export const EDITOR_TAG = `${CARD_TAG}-editor`;
export const CARD_VERSION = __CARD_VERSION__;

/**
 * The repository is prefixed, the card tag is not: the prefix groups the repo
 * among Lovelace cards, while `type: custom:...` is typed by every user and
 * stays as short as it can be.
 */
export const REPO_URL =
  "https://github.com/julezdean/lovelace-advanced-countdown-card";

/**
 * Minimum Home Assistant version, the same floor as the sibling cards. Nothing
 * below it is tested. Two newer features are used when present and have a
 * fallback when not:
 *  - `last_transition` on timers (2026.5.0) tells a finished timer from a
 *    cancelled one once it is idle.
 *  - `getGridOptions` (sections view) is simply not called by older versions.
 */
export const MIN_HA_VERSION = "2024.4.0";

/** Pointer gesture timings, the same values as the multi-button card. */
export const HOLD_DELAY_MS = 500;
export const DOUBLE_TAP_WINDOW_MS = 250;
