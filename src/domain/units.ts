import type { DisplayUnit } from './types';

const METERS_TO_UNIT_FACTOR: Record<DisplayUnit, number> = {
  m: 1,
  cm: 100,
  mm: 1000,
};

const DEFAULT_DISPLAY_DECIMALS: Record<DisplayUnit, number> = {
  mm: 1,
  cm: 2,
  m: 3,
};

export function roundClean(value: number, decimals = 6): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function metersToUnit(meters: number, unit: DisplayUnit): number {
  return roundClean(meters * METERS_TO_UNIT_FACTOR[unit], 6);
}

export function unitToMeters(value: number, unit: DisplayUnit): number {
  return roundClean(value / METERS_TO_UNIT_FACTOR[unit], 8);
}

export function formatLengthValue(
  meters: number,
  unit: DisplayUnit,
  maxDecimals = DEFAULT_DISPLAY_DECIMALS[unit],
): string {
  const converted = roundClean(metersToUnit(meters, unit), maxDecimals);
  return String(converted);
}

export function formatLength(
  meters: number,
  unit: DisplayUnit,
  maxDecimals = DEFAULT_DISPLAY_DECIMALS[unit],
): string {
  return `${formatLengthValue(meters, unit, maxDecimals)} ${unit}`;
}

export function radiansToDegrees(radians: number): number {
  return roundClean((radians * 180) / Math.PI, 2);
}

export function degreesToRadians(degrees: number): number {
  return roundClean((degrees * Math.PI) / 180, 6);
}

export function getUnitStep(unit: DisplayUnit): number {
  switch (unit) {
    case 'mm':
      return 1;
    case 'cm':
      return 0.5;
    case 'm':
      return 0.01;
  }
}
