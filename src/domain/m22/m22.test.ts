import { describe, it, expect } from 'vitest';
import { nextLibraryStatus, publishedCount, distinctCategories, countByCategory } from './library';
import type { LibraryDoc } from './types';

const d = (category: LibraryDoc['category'], status: LibraryDoc['status']): Pick<LibraryDoc, 'category' | 'status'> => ({ category, status });

describe('M22 — GED transverse', () => {
  it('cycle brouillon → publié → archivé', () => {
    expect(nextLibraryStatus('brouillon')).toBe('publie');
    expect(nextLibraryStatus('publie')).toBe('archive');
    expect(nextLibraryStatus('archive')).toBeNull();
  });
  it('compteurs publiés & catégories', () => {
    const list = [d('contrat', 'publie'), d('financier', 'publie'), d('contrat', 'brouillon'), d('technique', 'archive')];
    expect(publishedCount(list)).toBe(2);
    expect(distinctCategories(list)).toBe(3);
    expect(countByCategory(list).contrat).toBe(2);
  });
});
