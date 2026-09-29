import { html, nothing, type TemplateResult } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import type { RendererDefinition } from "../core/registry";
import type { CardConfig, CountdownStatus, HassEntity, ViewModel } from "../types";
import { resolveColor } from "../utils/colors";

/**
 * Puts the parts together: header (icon, title, subtitle), the visual, the
 * value, and a footer (status, percentage). The renderer only draws the
 * visual; where everything else goes depends on the layout, and whether the
 * value appears a second time depends on whether the visual already shows it.
 *
 *   vertical                    everything stacked
 *   horizontal + ring/gauge     visual left, text column right
 *   horizontal + bar/digits     header row with the value on the right,
 *                               visual full width below
 */

export interface LayoutInput {
  vm: ViewModel;
  config: CardConfig;
  renderer: RendererDefinition;
  entity?: HassEntity;
  uid: string;
}

const STATUS_COLOR: Record<CountdownStatus, string> = {
  active: "var(--acc-color)",
  paused: "var(--warning-color, #ffa600)",
  idle: "var(--disabled-color, var(--acc-muted))",
  finished: "var(--success-color, #43a047)",
  unknown: "var(--disabled-color, var(--acc-muted))",
};

function iconTemplate(
  config: CardConfig,
  entity: HassEntity | undefined,
  cls = "",
): TemplateResult | typeof nothing {
  const icon = config.icon.icon;
  if (icon === false) return nothing;
  const explicit = icon === "auto" ? undefined : icon;
  // ha-state-icon picks the entity's own icon, including state-dependent ones
  // (a paused timer's icon differs from an active one's).
  if (entity) {
    return html`<ha-state-icon
      class=${cls}
      .stateObj=${entity}
      .icon=${explicit}
    ></ha-state-icon>`;
  }
  return html`<ha-icon
    class=${cls}
    .icon=${explicit ?? "mdi:timer-outline"}
  ></ha-icon>`;
}

/** Whether the visual already shows the main value, so it is not repeated. */
export function visualShowsValue(
  renderer: RendererDefinition,
  config: CardConfig,
): boolean {
  if (renderer.type === "digital" || renderer.type === "numeric") return true;
  return renderer.hasInner && config.display.inner === "value";
}

function innerContent(input: LayoutInput): TemplateResult | undefined {
  const { vm, config, renderer, entity } = input;
  if (!renderer.hasInner) return undefined;
  const iconInside = config.icon.position === "inner" && config.icon.icon !== false;
  const smallIcon =
    iconInside && config.display.inner !== "icon"
      ? html`<div class="inner-icon small">${iconTemplate(config, entity)}</div>`
      : nothing;

  switch (config.display.inner) {
    case "none":
      return iconInside
        ? html`<div class="inner-icon">${iconTemplate(config, entity)}</div>`
        : undefined;
    case "icon":
      return html`<div class="inner-icon">${iconTemplate(config, entity)}</div>`;
    case "percentage": {
      const text =
        vm.progress === null ? "–" : `${Math.round(vm.progress * 100)} %`;
      return html`${smallIcon}<span
          class="inner-value"
          style="--acc-chars:${text.length}"
          >${text}</span
        >`;
    }
    default: {
      const value = vm.texts.value ?? "";
      const sub = vm.texts.percentage;
      return html`${smallIcon}
        <span class="inner-value" style="--acc-chars:${Math.max(4, value.length)}"
          >${value}</span
        >
        ${sub ? html`<span class="inner-sub">${sub}</span>` : nothing}`;
    }
  }
}

function header(
  input: LayoutInput,
  valueInline?: string,
): TemplateResult | typeof nothing {
  const { vm, config, entity } = input;
  const { title, subtitle } = vm.texts;
  const showIcon = config.icon.icon !== false && config.icon.position !== "inner";
  if (!title && !subtitle && !showIcon && !valueInline) return nothing;
  return html`
    <div class="header ${config.icon.position === "top" ? "icon-top" : ""}">
      ${showIcon ? html`<div class="icon-badge">${iconTemplate(config, entity)}</div>` : nothing}
      ${
        title || subtitle
          ? html`<div class="titles">
              ${title ? html`<div class="title">${title}</div>` : nothing}
              ${subtitle ? html`<div class="subtitle">${subtitle}</div>` : nothing}
            </div>`
          : nothing
      }
      ${valueInline ? html`<div class="value-inline">${valueInline}</div>` : nothing}
    </div>
  `;
}

function footer(
  vm: ViewModel,
  percentage: string | undefined,
  spread = false,
): TemplateResult | typeof nothing {
  if (!vm.texts.status && !percentage) return nothing;
  return html`
    <div class="footer ${spread ? "spread" : ""}">
      ${
        vm.texts.status
          ? html`<span
              class="status"
              style="--acc-status-color:${STATUS_COLOR[vm.status]}"
              >${vm.texts.status}</span
            >`
          : nothing
      }
      ${percentage ? html`<span class="percentage">${percentage}</span>` : nothing}
    </div>
  `;
}

function charsOf(vm: ViewModel): number {
  const groups = vm.digits;
  if (groups?.length)
    return (
      groups.join(":").length +
      (vm.remainingMs !== undefined && vm.remainingMs < 0 ? 1 : 0)
    );
  return Math.max(4, (vm.texts.value ?? "").length);
}

export function renderLayout(input: LayoutInput): TemplateResult {
  const { vm, config, renderer } = input;
  const minimal = config.layout.density === "minimal";
  const inner = innerContent(input);
  const inVisual = visualShowsValue(renderer, config);
  const round = renderer.type === "circle" || renderer.type === "radial";
  const verticalBar =
    (renderer.type === "bar" || renderer.type === "segments") &&
    config.display.orientation === "vertical";
  const horizontal = config.layout.orientation === "horizontal";
  const side = horizontal && (round || verticalBar);
  const linearHorizontal = horizontal && !side;

  // A percentage shown inside the ring is not repeated below it.
  const percentage =
    renderer.hasInner && config.display.inner === "value"
      ? undefined
      : vm.texts.percentage;
  const value = inVisual ? undefined : vm.texts.value;

  const visual = html`<div
    class="visual ${round ? "round" : ""} size-${config.display.size} effect-${vm.effect}"
    style="--acc-chars:${charsOf(vm)}"
  >
    ${renderer.render({ vm, config, inner, uid: input.uid })}
  </div>`;

  const classes = [
    "acc",
    config.layout.orientation,
    config.layout.density,
    `align-${config.layout.align}`,
    side ? "side" : "",
    `progress-${config.animation.enabled ? config.animation.progress : "none"}`,
    `status-${vm.status}`,
    vm.effect === "rotate" ? "effect-rotate" : "",
  ];

  const style = styleMap({
    "--acc-color": vm.color,
    "--acc-icon-color":
      config.icon.color === "auto" ? undefined : resolveColor(config.icon.color),
    "--acc-track-color": resolveColor(config.colors.track),
    "--acc-text": resolveColor(config.colors.text),
    "--acc-icon-scale": String(config.icon.size),
    "--acc-speed": { slow: "1.6", normal: "1", fast: "0.6" }[
      config.animation.speed
    ],
  });

  if (minimal) {
    return html`<div class=${classes.join(" ")} style=${style}>
      ${visual} ${value ? html`<div class="value-line">${value}</div>` : nothing}
    </div>`;
  }

  if (side) {
    return html`<div class=${classes.join(" ")} style=${style}>
      ${visual}
      <div class="column">
        ${header(input)}
        ${value ? html`<div class="value-line">${value}</div>` : nothing}
        ${footer(vm, percentage)}
      </div>
    </div>`;
  }

  if (linearHorizontal) {
    return html`<div class=${classes.join(" ")} style=${style}>
      ${header(input, value)} ${visual} ${footer(vm, percentage, true)}
    </div>`;
  }

  // Stacked: a bar reads as the underline of its number, so the number comes
  // first; a ring without the value inside keeps it underneath.
  const valueLine = value ? html`<div class="value-line">${value}</div>` : nothing;
  return html`<div class=${classes.join(" ")} style=${style}>
    ${header(input)} ${round ? nothing : valueLine} ${visual}
    ${round ? valueLine : nothing} ${footer(vm, percentage)}
  </div>`;
}

/** The error state: what is wrong and, where it helps, the offending value. */
export function renderNotice(vm: ViewModel): TemplateResult {
  return html`<div class="acc">
    <div class="notice" role="status">
      <div class="icon-badge">
        <ha-icon .icon=${"mdi:alert-circle-outline"}></ha-icon>
      </div>
      <div class="titles">
        ${vm.texts.title ? html`<div class="title">${vm.texts.title}</div>` : nothing}
        <div class="message">${vm.texts.value}</div>
        ${vm.texts.subtitle ? html`<div class="detail">${vm.texts.subtitle}</div>` : nothing}
      </div>
    </div>
  </div>`;
}
