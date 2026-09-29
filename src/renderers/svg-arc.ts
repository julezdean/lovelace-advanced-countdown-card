/**
 * Geometry for the ring and the arc. Angles are in degrees, clockwise, with
 * 0 at twelve o'clock -- the way a clock face and a progress ring are read.
 */

export const circumference = (r: number): number => 2 * Math.PI * r;

/** Dash offset that leaves `fraction` of the stroke visible. */
export const dashOffset = (length: number, fraction: number): number =>
  length * (1 - Math.min(1, Math.max(0, fraction)));

export function polar(
  cx: number,
  cy: number,
  r: number,
  deg: number,
): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

/** SVG path for an arc from `startDeg`, sweeping `sweepDeg` clockwise. */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  sweepDeg: number,
): string {
  const sweep = Math.min(359.999, Math.max(0, sweepDeg));
  const [x1, y1] = polar(cx, cy, r, startDeg);
  const [x2, y2] = polar(cx, cy, r, startDeg + sweep);
  const large = sweep > 180 ? 1 : 0;
  const f = (n: number) => Math.round(n * 1000) / 1000;
  return `M ${f(x1)} ${f(y1)} A ${f(r)} ${f(r)} 0 ${large} 1 ${f(x2)} ${f(y2)}`;
}

/** Arc length of `sweepDeg` degrees on radius r. */
export const arcLength = (r: number, sweepDeg: number): number =>
  (circumference(r) * sweepDeg) / 360;

/**
 * The lowest point an arc with its opening centred at six o'clock reaches,
 * including half the stroke -- how tall the viewBox has to be so a 270° gauge
 * does not carry a band of empty space below its ends.
 */
export function arcBottom(
  cy: number,
  r: number,
  openingDeg: number,
  stroke: number,
): number {
  if (openingDeg <= 0) return cy + r + stroke / 2;
  const endY = cy + r * Math.cos((openingDeg / 2) * (Math.PI / 180));
  return endY + stroke / 2;
}
