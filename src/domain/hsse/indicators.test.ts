import { describe, expect, it } from 'vitest';
import { accidentsAvecArret, complianceRate, heuresTravaillees, isCompliant, tauxFrequence, tauxGravite } from './hsse';
import type { HsseKind } from './types';

const inc = (kind: HsseKind, daysLost: number) => ({ kind, daysLost });

describe('M19 HSSE — indicateurs réglementaires', () => {
  it('ne compte comme accident avec arrêt que les accidents ayant des journées perdues', () => {
    expect(accidentsAvecArret([inc('accident', 3), inc('accident', 0), inc('presqu_accident', 2)])).toBe(1);
  });

  it('calcule le taux de fréquence sur un million d’heures', () => {
    expect(tauxFrequence([inc('accident', 3), inc('presqu_accident', 0)], 200_000)).toBe(5);
  });

  it('calcule le taux de gravité sur mille heures', () => {
    expect(tauxGravite([inc('accident', 3), inc('accident', 17)], 200_000)).toBeCloseTo(0.1, 6);
  });

  it('refuse d’afficher un taux sans heures travaillées', () => {
    expect(tauxFrequence([inc('accident', 3)], 0)).toBeNull();
    expect(tauxGravite([inc('accident', 3)], 0)).toBeNull();
  });

  it('cumule les heures déclarées visite après visite', () => {
    expect(heuresTravaillees([{ hoursWorked: 90_000 }, { hoursWorked: 110_000 }])).toBe(200_000);
  });

  it('applique le seuil de conformité de 80/100', () => {
    expect(isCompliant(79)).toBe(false);
    expect(isCompliant(80)).toBe(true);
    expect(complianceRate([])).toBeNull();
    expect(complianceRate([{ score: 90 }, { score: 60 }])).toBe(0.5);
  });
});
