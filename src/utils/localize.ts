import type { CountdownStatus, ErrorReason } from "../types";

/**
 * The card's own strings. Everything Home Assistant already translates -- the
 * entity state, unit names via Intl -- is taken from there instead; this list
 * is only what no other source knows.
 */

type Key =
  | CountdownStatus
  | `error_${ErrorReason}`
  | "ends"
  | "ended"
  | "until"
  | "loading"
  | "config_error";

const EN: Record<Key, string> = {
  active: "Running",
  paused: "Paused",
  idle: "Idle",
  finished: "Finished",
  unknown: "Unknown",
  ends: "Ends {time}",
  ended: "Ended {time}",
  until: "until {time}",
  loading: "Loading…",
  config_error: "Configuration error",
  error_no_entity: "No entity configured",
  error_entity_missing: "Entity not found",
  error_unavailable: "Entity unavailable",
  error_unknown_state: "No value yet",
  error_invalid_timestamp: "Invalid timestamp",
  error_invalid_number: "Not a number",
  error_undetectable: "Cannot tell what this entity holds",
  error_template_error: "Template error",
  error_template_loading: "Loading…",
};

const DE: Record<Key, string> = {
  active: "Läuft",
  paused: "Pausiert",
  idle: "Bereit",
  finished: "Fertig",
  unknown: "Unbekannt",
  ends: "Endet {time}",
  ended: "Beendet {time}",
  until: "bis {time}",
  loading: "Lädt…",
  config_error: "Konfigurationsfehler",
  error_no_entity: "Keine Entity konfiguriert",
  error_entity_missing: "Entity nicht gefunden",
  error_unavailable: "Entity nicht verfügbar",
  error_unknown_state: "Noch kein Wert",
  error_invalid_timestamp: "Ungültiger Zeitstempel",
  error_invalid_number: "Keine Zahl",
  error_undetectable: "Datentyp der Entity nicht erkennbar",
  error_template_error: "Template-Fehler",
  error_template_loading: "Lädt…",
};

const TABLES: Record<string, Record<Key, string>> = { en: EN, de: DE };

export type Translate = (key: Key, vars?: Record<string, string>) => string;

export function translator(language: string | undefined): Translate {
  const base = (language ?? "en").toLowerCase().split(/[-_]/)[0];
  const table = TABLES[base] ?? EN;
  return (key, vars) => {
    let text = table[key] ?? EN[key] ?? key;
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replace(`{${name}}`, value);
      }
    }
    return text;
  };
}
