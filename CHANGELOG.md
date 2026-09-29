# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

First version.

### Added

- A countdown and progress card for three kinds of data: Home Assistant
  `timer` entities, any entity whose state or attribute is a point in time,
  and numbers on a scale (percentages by default). `source.type: auto` tells
  them apart from the entity itself.
- Timers are read the way core writes them: the live countdown comes from
  `finishes_at`, because a running timer never updates `remaining`. Paused
  timers show their frozen remaining time, idle ones their duration, and --
  on Home Assistant 2026.5 and newer -- an idle timer whose `last_transition`
  is `finished` is shown as finished rather than idle.
- Timestamps without an offset are read in the Home Assistant server's time
  zone, not the browser's, and timestamps are parsed by the card itself rather
  than by `Date.parse`, whose handling of microseconds and space-separated
  dates differs between browsers.
- `source.type: template`: Home Assistant renders a Jinja template and pushes
  the result; the card never polls. A template may return a timestamp, a number
  or a mapping with `start`, `end`, `value`, `min`, `max` and `name`.
- Six visualisations: ring, gauge, bar, segments, digital tiles and a plain
  number, all drawn in SVG and CSS without dependencies besides Lit.
- The countdown runs in the browser. All cards on a page share one timer, which
  wakes each card at the millisecond its display changes -- a timer's end is
  not on a whole second -- and stops while the tab is hidden.
- Thresholds and gradients for the progress colour. Gradients mix in OKLCH, so
  green to red passes through yellow rather than brown.
- `on_complete`: show 00:00, show a text, count up, or hide the card -- which
  also frees its place in a sections view.
- Tap, hold and double tap run through Home Assistant's own action handler, so
  every action including `confirmation` works as on any built-in card.
- A visual editor on `ha-form` that writes back only what differs from the
  defaults.
- Error states for missing, unavailable and unknown entities, invalid
  timestamps, non-numeric values and template errors, shown in the card with
  the offending value.

[Unreleased]: https://github.com/julezdean/lovelace-advanced-countdown-card/commits/main
