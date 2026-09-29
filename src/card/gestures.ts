import { DOUBLE_TAP_WINDOW_MS, HOLD_DELAY_MS } from "../const";
import type { ActionConfig } from "../types";

/**
 * Tap, hold and double tap on one element, then Home Assistant runs the
 * action.
 *
 * The card does not implement a single action itself. It fires `hass-action`
 * with the action config and the gesture, and Home Assistant's own handler
 * (src/state/action-mixin.ts, since June 2023) does the rest: more-info,
 * navigate, url, toggle, perform-action, assist -- and the `confirmation`
 * dialog, which a custom card could not open on its own. A tap_action written
 * for any other card works here unchanged.
 *
 * Only the gesture recognition is the card's, because Home Assistant's
 * action-handler directive is internal. The rules are the multi-button card's:
 *  - A plain tap fires on pointerup with no delay. The 250 ms double-tap window
 *    opens only when a double_tap_action exists; responsiveness on a wall
 *    tablet matters more than universal double-tap support.
 *  - Moving more than 12 px is a scroll, not a tap.
 *  - Keyboard and assistive technology produce a click without pointer events;
 *    Enter and Space are a tap.
 */

export type Gesture = "tap" | "hold" | "double_tap";

export interface ActionSet {
  entity?: string;
  tap_action: ActionConfig;
  hold_action: ActionConfig;
  double_tap_action: ActionConfig;
}

export const hasAction = (action: ActionConfig | undefined): boolean =>
  !!action && action.action !== "none";

export function fireAction(
  node: HTMLElement,
  actions: ActionSet,
  gesture: Gesture,
): void {
  const action = actions[`${gesture}_action`];
  if (!hasAction(action)) return;
  node.dispatchEvent(
    new CustomEvent("hass-action", {
      bubbles: true,
      composed: true,
      detail: { config: actions, action: gesture },
    }),
  );
}

export class GestureHandler {
  private holdTimer?: ReturnType<typeof setTimeout>;
  private tapTimer?: ReturnType<typeof setTimeout>;
  private held = false;
  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private lastPointerUp = 0;
  private element?: HTMLElement;

  constructor(private readonly actions: () => ActionSet | undefined) {}

  attach(element: HTMLElement): void {
    if (this.element === element) return;
    this.detach();
    this.element = element;
    element.addEventListener("pointerdown", this.onDown);
    element.addEventListener("pointermove", this.onMove);
    element.addEventListener("pointerup", this.onUp);
    element.addEventListener("pointercancel", this.onCancel);
    element.addEventListener("pointerleave", this.onLeave);
    element.addEventListener("click", this.onClick);
    element.addEventListener("keydown", this.onKey);
    element.addEventListener("contextmenu", this.onContextMenu);
  }

  detach(): void {
    const element = this.element;
    if (!element) return;
    element.removeEventListener("pointerdown", this.onDown);
    element.removeEventListener("pointermove", this.onMove);
    element.removeEventListener("pointerup", this.onUp);
    element.removeEventListener("pointercancel", this.onCancel);
    element.removeEventListener("pointerleave", this.onLeave);
    element.removeEventListener("click", this.onClick);
    element.removeEventListener("keydown", this.onKey);
    element.removeEventListener("contextmenu", this.onContextMenu);
    this.cancel();
    this.element = undefined;
  }

  private fire(gesture: Gesture): void {
    const actions = this.actions();
    if (actions && this.element) fireAction(this.element, actions, gesture);
  }

  private cancel(): void {
    if (this.holdTimer) clearTimeout(this.holdTimer);
    if (this.tapTimer) clearTimeout(this.tapTimer);
    this.holdTimer = undefined;
    this.tapTimer = undefined;
    this.pointerId = null;
    this.held = false;
    this.element?.classList.remove("pressed");
  }

  private readonly onDown = (event: PointerEvent) => {
    if (event.button !== undefined && event.button > 0) return;
    const actions = this.actions();
    if (!actions) return;
    this.pointerId = event.pointerId;
    this.held = false;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.element?.classList.add("pressed");
    if (hasAction(actions.hold_action)) {
      this.holdTimer = setTimeout(() => {
        this.holdTimer = undefined;
        this.held = true;
        this.element?.classList.remove("pressed");
        this.fire("hold");
      }, HOLD_DELAY_MS);
    }
  };

  private readonly onMove = (event: PointerEvent) => {
    if (this.pointerId !== event.pointerId) return;
    if (
      Math.abs(event.clientX - this.startX) > 12 ||
      Math.abs(event.clientY - this.startY) > 12
    ) {
      this.cancel();
    }
  };

  private readonly onUp = (event: PointerEvent) => {
    if (this.pointerId !== event.pointerId) return;
    this.element?.classList.remove("pressed");
    this.pointerId = null;
    this.lastPointerUp = Date.now();
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = undefined;
    }
    if (this.held) {
      this.held = false;
      return;
    }
    const actions = this.actions();
    if (!actions) return;
    if (!hasAction(actions.double_tap_action)) {
      this.fire("tap");
      return;
    }
    if (this.tapTimer) {
      clearTimeout(this.tapTimer);
      this.tapTimer = undefined;
      this.fire("double_tap");
      return;
    }
    this.tapTimer = setTimeout(() => {
      this.tapTimer = undefined;
      this.fire("tap");
    }, DOUBLE_TAP_WINDOW_MS);
  };

  private readonly onCancel = () => this.cancel();

  private readonly onLeave = () => {
    this.element?.classList.remove("pressed");
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = undefined;
    }
  };

  private readonly onClick = (event: MouseEvent) => {
    // A pointer tap was already handled on pointerup.
    if (Date.now() - this.lastPointerUp < 700) return;
    event.preventDefault();
    this.fire("tap");
  };

  private readonly onKey = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    this.fire("tap");
  };

  private readonly onContextMenu = (event: Event) => {
    // A long press on touch opens the context menu otherwise.
    if (hasAction(this.actions()?.hold_action)) event.preventDefault();
  };
}
