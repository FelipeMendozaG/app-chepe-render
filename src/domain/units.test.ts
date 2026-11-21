import { describe, expect, it } from 'vitest';
import {
  degreesToRadians,
  formatLength,
  metersToUnit,
  radiansToDegrees,
  unitToMeters,
} from './units';

describe('units', () => {
  it('convierte metros a mm, cm y m sin ruido flotante', () => {
    expect(metersToUnit(1.8, 'cm')).toBe(180);
    expect(metersToUnit(0.018, 'mm')).toBe(18);
    expect(metersToUnit(0.75, 'm')).toBe(0.75);
  });

  it('convierte mm, cm y m de vuelta a metros con precisión', () => {
    expect(unitToMeters(180, 'cm')).toBe(1.8);
    expect(unitToMeters(18, 'mm')).toBe(0.018);
    expect(unitToMeters(1.4, 'm')).toBe(1.4);
  });

  it('formatea longitudes con su unidad activa', () => {
    expect(formatLength(1.8, 'cm')).toBe('180 cm');
    expect(formatLength(0.018, 'mm')).toBe('18 mm');
    expect(formatLength(0.75, 'm')).toBe('0.75 m');
  });

  it('convierte grados y radianes de forma reversible', () => {
    const rad = degreesToRadians(90);
    expect(rad).toBeCloseTo(Math.PI / 2, 5);
    expect(radiansToDegrees(rad)).toBe(90);
  });
});
