import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { RenderedTemplate } from "../core/registry";
import type { HomeAssistant } from "../types";

/**
 * Owns the `render_template` subscription for source.type: template.
 *
 * Home Assistant renders the template on the server, tracks which entities it
 * reads, and pushes a new result whenever one of them changes -- so the card
 * never polls and never re-sends the template. The websocket command has no
 * require_admin decorator (websocket_api/commands.py), so it works for every
 * user, not just administrators.
 *
 * The lifecycle is the same as the forecast subscription in the clock-weather
 * card, including the case that goes wrong most often: the card is removed
 * while the subscribe promise is still in flight. A generation counter marks
 * every teardown; a result or a resolved promise from an older generation is
 * dropped, and a late subscription is closed immediately instead of living on
 * the server for the rest of the session.
 *
 * `subscribeMessage` re-establishes the subscription after a dropped websocket
 * by itself (resubscribe defaults to true). What it does not cover is Lovelace
 * detaching the card from the DOM on a view switch -- hostConnected /
 * hostDisconnected handle that.
 */

interface RenderTemplateResult {
  result?: unknown;
  error?: string;
  level?: "ERROR" | "WARNING";
}

function messageOf(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unknown error";
}

export class TemplateController implements ReactiveController {
  private _hass?: HomeAssistant;
  private _template?: string;
  private _entityId?: string;
  private _connected = false;
  private _unsubscribe?: () => Promise<void>;
  private _generation = 0;
  private _rendered: RenderedTemplate = { status: "loading" };

  constructor(
    host: ReactiveControllerHost,
    private readonly onChange: () => void,
  ) {
    host.addController(this);
  }

  get rendered(): RenderedTemplate {
    return this._rendered;
  }

  /** For tests and the demo: whether a subscription is open right now. */
  get active(): boolean {
    return this._unsubscribe !== undefined;
  }

  hostConnected(): void {
    this._connected = true;
    void this._subscribe();
  }

  hostDisconnected(): void {
    this._connected = false;
    this._teardown();
  }

  /**
   * Called from the card's hass setter and setConfig. Only a change of the
   * template, the entity passed in as a variable or the connection tears the
   * subscription down -- hass itself is replaced on every state change.
   */
  update(
    hass: HomeAssistant | undefined,
    template: string | undefined,
    entityId?: string,
  ): void {
    const changed =
      this._hass?.connection !== hass?.connection ||
      this._template !== template ||
      this._entityId !== entityId;
    this._hass = hass;
    if (!changed) return;
    this._template = template;
    this._entityId = entityId;
    this._teardown();
    this._rendered = { status: "loading" };
    if (this._connected) void this._subscribe();
  }

  private _set(rendered: RenderedTemplate): void {
    this._rendered = rendered;
    this.onChange();
  }

  private async _subscribe(): Promise<void> {
    const hass = this._hass;
    const template = this._template;
    if (!hass?.connection || !template || this._unsubscribe) return;
    const generation = this._generation;

    try {
      const unsubscribe =
        await hass.connection.subscribeMessage<RenderTemplateResult>(
          (message) => {
            if (generation !== this._generation) return;
            if (message && "error" in message && message.error !== undefined) {
              // A WARNING (an undefined variable, typically) still produced a
              // result; only an ERROR means there is nothing to show.
              if (message.level === "WARNING") return;
              this._set({ status: "error", error: message.error });
              return;
            }
            this._set({ status: "ready", value: message?.result });
          },
          {
            type: "render_template",
            template,
            // `entity` inside the template refers to the card's entity, the way
            // Mushroom and the markdown card offer it.
            variables: this._entityId ? { entity: this._entityId } : {},
            report_errors: true,
          },
        );
      if (generation !== this._generation) {
        void unsubscribe().catch(() => undefined);
        return;
      }
      this._unsubscribe = unsubscribe;
    } catch (error) {
      if (generation !== this._generation) return;
      // A syntax error is rejected up front, before any result.
      this._set({ status: "error", error: messageOf(error) });
    }
  }

  private _teardown(): void {
    this._generation += 1;
    const unsubscribe = this._unsubscribe;
    this._unsubscribe = undefined;
    if (unsubscribe) void unsubscribe().catch(() => undefined);
  }
}
