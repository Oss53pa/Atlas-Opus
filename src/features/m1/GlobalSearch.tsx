import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useContracts, useDocuments, useLandOpportunities, useOperations, useRfis, useStakeholders } from '../../app/providers';
import { useNav, type Route } from '../../app/router';
import { t, type MessageKey } from '../../i18n';
import { search, type SearchHit, type SearchItem } from '../../domain/f4/search';

/**
 * Recherche globale de la barre latérale (⌘K / Ctrl+K). Hors opération : les
 * opérations et le pipeline foncier de l'espace ; dans une opération : ses
 * intervenants, marchés, documents et RFI en plus. N'interroge que des listes
 * déjà filtrées par la RLS — la recherche ne révèle rien de plus que les écrans.
 */
export function GlobalSearch({ operationId }: { operationId: string | null }) {
  return operationId ? <OperationSearch operationId={operationId} /> : <TenantSearch />;
}

function useTenantItems(): SearchItem[] {
  const { data: ops } = useOperations({});
  const { data: opps } = useLandOpportunities();
  return useMemo(() => [
    ...(ops ?? []).map((o): SearchItem => ({ kind: 'operation', id: o.id, label: o.name, sublabel: o.countryCode })),
    ...(opps ?? []).map((o): SearchItem => ({ kind: 'opportunity', id: o.id, label: o.name, sublabel: o.reference, keywords: [o.city] })),
  ], [ops, opps]);
}

function TenantSearch() {
  return <SearchBox items={useTenantItems()} placeholderKey="shell.search.tenant" operationId={null} />;
}

function OperationSearch({ operationId }: { operationId: string }) {
  const tenant = useTenantItems();
  const { data: stakeholders } = useStakeholders(operationId);
  const { data: contracts } = useContracts(operationId);
  const { data: documents } = useDocuments(operationId);
  const { data: rfis } = useRfis(operationId);
  const items = useMemo(() => [
    ...(stakeholders ?? []).map((s): SearchItem => ({ kind: 'stakeholder', id: s.id, label: s.name, sublabel: s.mission, keywords: [s.email] })),
    ...(contracts ?? []).map((c): SearchItem => ({ kind: 'contract', id: c.id, label: c.reference, sublabel: c.contractor })),
    ...(documents ?? []).map((d): SearchItem => ({ kind: 'document', id: d.id, label: d.title, sublabel: d.reference })),
    ...(rfis ?? []).map((r): SearchItem => ({ kind: 'rfi', id: r.id, label: r.subject, sublabel: r.number })),
    ...tenant,
  ], [stakeholders, contracts, documents, rfis, tenant]);
  return <SearchBox items={items} placeholderKey="shell.search.operation" operationId={operationId} />;
}

function routeFor(hit: SearchHit, opId: string | null): Route | null {
  switch (hit.kind) {
    case 'operation': return { name: 'cockpit', id: hit.id };
    case 'opportunity': return { name: 'foncier' };
    case 'stakeholder': return opId ? { name: 'stakeholder', id: opId, sid: hit.id } : null;
    case 'contract': return opId ? { name: 'marche', id: opId, cid: hit.id } : null;
    case 'document': return opId ? { name: 'docVisa', id: opId, did: hit.id } : null;
    case 'rfi': return opId ? { name: 'rfiDetail', id: opId, rid: hit.id } : null;
    default: return null;
  }
}

function SearchBox({ items, placeholderKey, operationId }: { items: SearchItem[]; placeholderKey: MessageKey; operationId: string | null }) {
  const { navigate } = useNav();
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const hits = useMemo(() => search(items, term, 12), [items, term]);

  // ⌘K / Ctrl+K : focus de la recherche depuis n'importe quel écran.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => setCursor(0), [term]);

  function pick(hit: SearchHit) {
    const r = routeFor(hit, operationId);
    if (!r) return;
    navigate(r);
    setTerm('');
    setOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div className="relative">
      <label className="ax-search">
        <Search size={14} className="text-ink-3" aria-hidden="true" />
        <input
          ref={inputRef}
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          placeholder={t(placeholderKey)}
          aria-label={t('search.label')}
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls="ax-global-search-results"
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
            else if (e.key === 'Enter' && hits[cursor]) { e.preventDefault(); pick(hits[cursor]); }
            else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
          }}
        />
        <span className="mono text-[11px] text-ink-3" aria-hidden="true">{t('shell.search.hint')}</span>
      </label>
      {open && term.trim().length >= 2 && (
        <div id="ax-global-search-results" role="listbox" className="ax-menu" style={{ left: 0, right: 0, top: 38, width: 'auto', maxHeight: 360, overflowY: 'auto' }}>
          {hits.length === 0 ? (
            <div className="px-2.5 py-2 text-[12px] text-ink-3">{t('search.empty', { term })}</div>
          ) : hits.map((h, i) => (
            <button
              key={`${h.kind}-${h.id}`}
              role="option"
              aria-selected={i === cursor}
              className="ax-menu-item w-full text-left"
              style={i === cursor ? { background: 'var(--ax-surface-total)' } : undefined}
              onMouseDown={(e) => { e.preventDefault(); pick(h); }}
              onMouseEnter={() => setCursor(i)}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{h.label}</span>
                {h.sublabel && <span className="block truncate text-[11px] text-ink-3">{h.sublabel}</span>}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-ink-3">{t(`search.kind.${h.kind}` as MessageKey)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
