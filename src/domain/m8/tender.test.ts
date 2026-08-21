import { describe, it, expect } from 'vitest';
import { nextTenderStatus, requiresAward } from './tender';

describe('Passation §M8', () => {
  it('machine de statut linéaire', () => {
    expect(nextTenderStatus('planned')).toBe('published');
    expect(nextTenderStatus('opened')).toBe('evaluated');
    expect(nextTenderStatus('awarded')).toBe('notified');
    expect(nextTenderStatus('notified')).toBeNull();
  });
  it('attribution requise à partir de awarded', () => {
    expect(requiresAward('evaluated')).toBe(false);
    expect(requiresAward('awarded')).toBe(true);
    expect(requiresAward('notified')).toBe(true);
  });
});
