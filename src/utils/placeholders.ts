import type { HassEntity } from "../types";

/**
 * {placeholders} in text areas. Deliberately not a template language: no
 * expressions, no filters, no server round trip. Anything that needs logic
 * belongs in `source.type: template`, which Home Assistant renders.
 *
 *   {name} {state} {value} {unit} {remaining} {percentage} {status}
 *   {end_time} {end_date} {attr:some_attribute}
 *
 * An unknown placeholder is left as written, so a typo is visible on the card
 * instead of vanishing.
 */

const PATTERN = /\{(attr:)?([a-z0-9_]+)\}/gi;

export function fillPlaceholders(
  text: string,
  values: Record<string, string | undefined>,
  entity?: HassEntity,
): string {
  return text.replace(PATTERN, (whole, attr: string | undefined, name: string) => {
    if (attr) {
      const value = entity?.attributes?.[name];
      if (value === undefined || value === null) return "";
      return typeof value === "object" ? JSON.stringify(value) : String(value);
    }
    const value = values[name.toLowerCase()];
    return value === undefined ? whole : value;
  });
}
