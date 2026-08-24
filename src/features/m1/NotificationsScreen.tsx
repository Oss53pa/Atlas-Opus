import { ChevronLeft } from 'lucide-react';
import { Button, KpiRow, Panel, Skeleton, FactList, EmptyState, useToast, type Fact } from '../../ui';
import { useNotifications } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { unreadCount, countBySeverity, type NotifSeverity, type NotificationItem } from '../../domain/admin';

const SEV_BAR: Record<NotifSeverity, 'danger' | 'accent' | 'neutral'> = {
  danger: 'danger', echeance: 'accent', info: 'neutral',
};

/** Regroupe par tranche : aujourd'hui / cette semaine / avant, sur une date de référence. */
function bucket(at: string, today: string): 'today' | 'week' | 'earlier' {
  const day = at.slice(0, 10);
  if (day === today) return 'today';
  const d = Date.parse(day);
  const t0 = Date.parse(today);
  const diff = (t0 - d) / 86_400_000;
  return diff <= 7 ? 'week' : 'earlier';
}

/**
 * Handoff 32 — Centre de notifications (F4). Notifications groupées par jour et
 * par sévérité (barre 3px : danger / échéance / info). Vue tenant. Le routage
 * par canal (app / e-mail / WhatsApp) suit la sévérité (préférences rapides).
 */
export function NotificationsScreen() {
  const { navigate } = useNav();
  const toast = useToast();
  const { data: items, loading } = useNotifications();

  if (loading) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 300 }} /><Skeleton style={{ height: 220 }} /></div>;

  const list = items ?? [];
  const today = '2026-08-19'; // date de référence de l'opération de démonstration
  const unread = unreadCount(list);
  const danger = countBySeverity(list, 'danger');
  const echeance = countBySeverity(list, 'echeance');
  const info = countBySeverity(list, 'info');

  const timeOf = (iso: string) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const dateOf = (iso: string) => new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' }).format(new Date(iso));

  const toFacts = (arr: NotificationItem[], withTime: boolean): Fact[] => arr.map((n) => ({
    label: n.title,
    sub: n.context,
    value: <span className="mono text-[12px]">{withTime ? timeOf(n.at) : dateOf(n.at)}</span>,
    severity: SEV_BAR[n.severity],
  }));

  const todayItems = list.filter((n) => bucket(n.at, today) === 'today');
  const weekItems = list.filter((n) => bucket(n.at, today) === 'week');
  const earlierItems = list.filter((n) => bucket(n.at, today) === 'earlier');

  const filterFacts: Fact[] = [
    { label: t('notif.filter.severity'), value: t('notif.sev.danger'), sub: undefined },
    { label: t('notif.filter.module'), value: t('notif.filter.all'), sub: 'M4, M7, M9, M11, M13, M16' },
    { label: t('notif.filter.operation'), value: 'Palmiers', sub: t('notif.filter.opSub', { n: 6 }) },
    { label: t('notif.filter.channel'), value: 'in-app' },
  ];
  const prefFacts: Fact[] = [
    { label: t('notif.sev.danger'), value: 'app · e-mail · WhatsApp' },
    { label: t('notif.sev.echeance'), value: 'app · e-mail' },
    { label: t('notif.sev.info'), value: t('notif.pref.appOnly') },
    { label: t('notif.pref.weekly'), value: t('notif.pref.weeklyVal') },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'dashboard' })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3">{t('notif.context', { unread, danger })}</div>
            <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{t('notif.title')}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="glass" size="sm">{t('notif.preferences')}</Button>
          <Button variant="primary" size="sm" onClick={() => toast.push(t('notif.allRead'), 'success')}>{t('notif.markAll')}</Button>
        </div>
      </div>

      <KpiRow
        items={[
          { label: t('notif.kpi.unread'), value: unread, accent: unread > 0 },
          { label: t('notif.kpi.danger'), value: danger, accent: danger > 0 },
          { label: t('notif.kpi.echeance'), value: echeance },
          { label: t('notif.kpi.info'), value: info },
          { label: t('notif.kpi.channels'), value: 3, sub: 'app · e-mail · WhatsApp' },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="flex flex-col gap-4">
          <Panel title={t('notif.today')} meta={t('notif.todayDate')} bodyPadded={false}>
            {todayItems.length ? <FactList items={toFacts(todayItems, true)} /> : <EmptyState title={t('notif.today')} description={t('notif.empty')} />}
          </Panel>
          {weekItems.length > 0 && (
            <Panel title={t('notif.week')} bodyPadded={false}><FactList items={toFacts(weekItems, false)} /></Panel>
          )}
          {earlierItems.length > 0 && (
            <Panel title={t('notif.earlier')} meta={t('notif.earlierMeta')} bodyPadded={false}><FactList items={toFacts(earlierItems, false)} /></Panel>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <Panel title={t('notif.filters')} bodyPadded={false}><FactList items={filterFacts} /></Panel>
          <Panel title={t('notif.prefs')} meta={t('notif.prefsMeta')} bodyPadded={false}><FactList items={prefFacts} /></Panel>
        </div>
      </div>

      <div className="text-[12px] text-ink-3">{t('notif.subtitle')}</div>
    </div>
  );
}
