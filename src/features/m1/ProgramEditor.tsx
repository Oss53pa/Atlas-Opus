import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, CheckCircle2, ArrowLeftRight } from 'lucide-react';
import { Badge, Banner, Button, Card, Field, Select, Skeleton, useToast } from '../../ui';
import { categoryLabel } from './labels';
import { useData, useOperation } from '../../app/providers';
import { useNav } from '../../app/router';
import { t } from '../../i18n';
import {
  PROGRAM_CATEGORIES,
  type ProgramCategory,
  type ProgramItem,
  type ProgramItemDraft,
} from '../../domain/m1/types';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

interface Diff {
  key: string;
  category: ProgramCategory;
  label: string;
  before: string | null | undefined;
  after: string | null | undefined;
  state: 'added' | 'removed' | 'changed' | 'same';
}

function valueOf(it: ProgramItem): string | null {
  return [it.targetValue, it.unit].filter(Boolean).join(' ') || null;
}

function buildDiff(after: ProgramItem[], before: ProgramItem[]): Diff[] {
  const map = new Map<string, Diff>();
  const k = (i: ProgramItem) => `${i.category}|${i.label}`;
  for (const b of before) map.set(k(b), { key: k(b), category: b.category, label: b.label, before: valueOf(b), after: undefined, state: 'removed' });
  for (const a of after) {
    const key = k(a);
    const ex = map.get(key);
    if (!ex) map.set(key, { key, category: a.category, label: a.label, before: undefined, after: valueOf(a), state: 'added' });
    else {
      ex.after = valueOf(a);
      ex.state = ex.before === ex.after ? 'same' : 'changed';
    }
  }
  return [...map.values()];
}

export function ProgramEditor({ id }: { id: string }) {
  const { program, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);

  const [cv, setCv] = useState<number | null>(null);
  const [versions, setVersions] = useState<number[]>([]);
  const [view, setView] = useState<number | null>(null);
  const [items, setItems] = useState<ProgramItem[] | null>(null);
  const [compare, setCompare] = useState(false);
  const [prevItems, setPrevItems] = useState<ProgramItem[]>([]);
  const [draft, setDraft] = useState<ProgramItemDraft>({ category: 'surface', label: '', targetValue: '', unit: '' });

  const reloadMeta = useCallback(async () => {
    const [c, vs] = await Promise.all([program.currentVersion(id), program.versions(id)]);
    setCv(c);
    setVersions(vs);
    setView((v) => v ?? c);
  }, [program, id]);

  useEffect(() => {
    reloadMeta();
  }, [reloadMeta]);

  const refreshItems = useCallback(async () => {
    if (view == null) return;
    setItems(await program.list(id, view));
    setPrevItems(view > 1 ? await program.list(id, view - 1) : []);
  }, [program, id, view]);

  useEffect(() => {
    refreshItems();
  }, [refreshItems]);

  const isWorking = view != null && view === cv;
  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'program.edit') && isWorking && !readOnly;
  const canValidate = can(session.role, 'program.validate') && isWorking && !readOnly;
  const hasPrev = view != null && view > 1;

  async function addItem() {
    if (!draft.label.trim()) return;
    await program.add(id, { ...draft, label: draft.label.trim() });
    setDraft({ category: 'surface', label: '', targetValue: '', unit: '' });
    toast.push(t('program.added'), 'success');
    refreshItems();
  }
  async function removeItem(itemId: string) {
    await program.remove(itemId);
    toast.push(t('program.removed'), 'info');
    refreshItems();
  }
  async function validate() {
    const frozen = await program.validateVersion(id);
    toast.push(t('program.version.validated', { n: frozen }), 'success');
    await reloadMeta();
    setView(frozen + 1);
  }

  const versionOptions = [...new Set([...versions, ...(cv ? [cv] : [])])].sort((a, b) => a - b);
  const diffs = compare ? buildDiff(items ?? [], prevItems) : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
              <ChevronLeft size={18} />
            </Button>
            <span className="text-[13px] text-ink-3">{op?.name}</span>
          </div>
          <h1 className="text-[24px] font-medium">{t('program.title')}</h1>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {view != null && (
            <Select id="pe-version" label={t('program.versionSelect')} value={String(view)} onChange={(e) => setView(Number(e.target.value))}>
              {versionOptions.map((v) => (
                <option key={v} value={v}>
                  {v === cv ? t('program.version.working', { n: v }) : t('program.version', { n: v })}
                </option>
              ))}
            </Select>
          )}
          {hasPrev && (
            <Button variant={compare ? 'primary' : 'glass'} size="sm" onClick={() => setCompare((c) => !c)}>
              <ArrowLeftRight size={16} />
              {t('program.compare')}
            </Button>
          )}
          {canValidate && (
            <Button variant="primary" size="sm" onClick={validate}>
              <CheckCircle2 size={16} />
              {t('program.validate')}
            </Button>
          )}
        </div>
      </div>

      {readOnly && <Banner tone="warning">{t('operation.status.closed')}</Banner>}

      {items == null ? (
        <Card>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} style={{ height: 40 }} />
            ))}
          </div>
        </Card>
      ) : compare ? (
        <Card tone="strong">
          <h2 className="mb-3 text-[15px] font-medium">{t('program.compare.with', { a: (view ?? 1) - 1, b: view ?? 1 })}</h2>
          <ul className="flex flex-col gap-2">
            {diffs.map((d) => (
              <li key={d.key} className="flex items-center justify-between gap-3 rounded-md px-3 py-2" style={{ background: 'var(--ax-glass-subtle)' }}>
                <span className="text-[13px]">
                  <span className="text-ink-3">{categoryLabel(d.category)} · </span>
                  {d.label}
                </span>
                <span className="flex items-center gap-2 text-[12px]">
                  {d.state === 'changed' && (
                    <span className="mono text-ink-2">
                      {d.before ?? '—'} → {d.after ?? '—'}
                    </span>
                  )}
                  {d.state === 'added' && <Badge tone="success">+ {d.after ?? ''}</Badge>}
                  {d.state === 'removed' && <Badge tone="danger">− {d.before ?? ''}</Badge>}
                  {d.state === 'same' && <span className="mono text-ink-3">{d.after ?? '—'}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {PROGRAM_CATEGORIES.map((cat) => {
            const list = items.filter((i) => i.category === cat);
            if (list.length === 0) return null;
            return (
              <Card key={cat} tone="strong">
                <div className="mb-3 text-[11px] uppercase tracking-wide text-ink-3">{categoryLabel(cat)}</div>
                <ul className="flex flex-col gap-2">
                  {list.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-3 rounded-md px-3 py-2" style={{ background: 'var(--ax-glass-subtle)' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px]">{it.label}</span>
                        {it.covered === false && <Badge tone="warning">{t('program.uncovered')}</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        {it.targetValue && <span className="mono text-[13px] text-ink-2">{it.targetValue} {it.unit}</span>}
                        {canEdit && (
                          <Button variant="ghost" size="sm" icon aria-label={t('program.removed')} onClick={() => removeItem(it.id)}>
                            <Trash2 size={15} />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}

          {canEdit && (
            <Card>
              <div className="mb-3 text-[15px] font-medium">{t('program.add')}</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select id="pe-cat" label={t('program.field.category')} value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as ProgramCategory }))}>
                  {PROGRAM_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </Select>
                <Field id="pe-label" label={t('program.field.label')} value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
                <Field id="pe-target" label={t('program.field.target')} value={draft.targetValue ?? ''} onChange={(e) => setDraft((d) => ({ ...d, targetValue: e.target.value }))} placeholder={t('program.field.target.ph')} />
                <Field id="pe-unit" label={t('program.field.unit')} value={draft.unit ?? ''} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))} placeholder={t('program.field.unit.ph')} />
              </div>
              <div className="mt-3">
                <Button variant="glass" size="sm" onClick={addItem}>
                  <Plus size={16} />
                  {t('program.add')}
                </Button>
              </div>
            </Card>
          )}

          {items.length === 0 && <Banner tone="info">{t('program.empty')}</Banner>}
        </div>
      )}
    </div>
  );
}
