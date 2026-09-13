import { describe, it, expect } from 'vitest';
import {
  isOpen, openCount, isOverdue, overdueCount, completionRate, sortByPriority,
  canTransitionActionItem, nextStatuses,
} from './actionItem';
import type { ActionItem } from './types';

const TODAY = '2026-09-13';

const a = (over: Partial<ActionItem> = {}): ActionItem => ({
  id: 'a', tenantId: 't', operationId: 'op', siteReportId: null,
  description: 'Reprendre étanchéité', owner: 'BET', dueDate: '2026-09-20', status: 'ouvert', ...over,
});

describe('actionItem — avancement & retard', () => {
  it('isOpen / openCount : ouvert et en_cours seulement', () => {
    expect(isOpen(a({ status: 'ouvert' }))).toBe(true);
    expect(isOpen(a({ status: 'en_cours' }))).toBe(true);
    expect(isOpen(a({ status: 'fait' }))).toBe(false);
    expect(isOpen(a({ status: 'annule' }))).toBe(false);
    expect(openCount([a(), a({ status: 'en_cours' }), a({ status: 'fait' })])).toBe(2);
  });

  it('isOverdue : échéance dépassée et action ouverte', () => {
    expect(isOverdue(a({ dueDate: '2026-09-01' }), TODAY)).toBe(true);
    expect(isOverdue(a({ dueDate: '2026-09-01', status: 'fait' }), TODAY)).toBe(false); // clos
    expect(isOverdue(a({ dueDate: '2026-09-20' }), TODAY)).toBe(false); // à venir
    expect(overdueCount([a({ dueDate: '2026-09-01' }), a({ dueDate: '2026-08-01', status: 'annule' }), a()], TODAY)).toBe(1);
  });

  it('completionRate = faites / total', () => {
    expect(completionRate([])).toBe(0);
    expect(completionRate([a({ status: 'fait' }), a({ status: 'ouvert' })])).toBe(0.5);
  });

  it('sortByPriority : retard, puis ouvertes par échéance, puis closes', () => {
    const list = [
      a({ id: 'done', status: 'fait', dueDate: '2026-01-01' }),
      a({ id: 'future', dueDate: '2026-12-01' }),
      a({ id: 'late', dueDate: '2026-08-01' }),
      a({ id: 'soon', dueDate: '2026-09-15' }),
    ];
    expect(sortByPriority(list, TODAY).map((x) => x.id)).toEqual(['late', 'soon', 'future', 'done']);
    // ne mute pas l'entrée
    expect(list[0].id).toBe('done');
  });
});

describe('actionItem — machine à états', () => {
  it('transitions autorisées / interdites', () => {
    expect(canTransitionActionItem('ouvert', 'en_cours')).toBe(true);
    expect(canTransitionActionItem('en_cours', 'fait')).toBe(true);
    expect(canTransitionActionItem('fait', 'ouvert')).toBe(false); // terminal
    expect(canTransitionActionItem('annule', 'en_cours')).toBe(false);
  });
  it('nextStatuses', () => {
    expect(nextStatuses('ouvert')).toEqual(['en_cours', 'fait', 'annule']);
    expect(nextStatuses('fait')).toEqual([]);
  });
});
