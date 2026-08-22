import { Topbar } from '../Shell';
import { Card, cx } from '../kit';
import { notifGroups } from '../data';

export function NotificationsScreen() {
  const unread = notifGroups[0].items.length;
  return (
    <>
      <Topbar
        title="Centre de notifications"
        context={`${unread} non lues · groupées par sévérité`}
        secondary={{ label: 'Tout marquer comme lu' }}
      />
      <div className="ao-content" style={{ maxWidth: 880 }}>
        {notifGroups.map((g) => (
          <Card key={g.day} title={g.day}>
            <div className="ao-facts">
              {g.items.map((n, i) => (
                <div className="ao-fact" key={i}>
                  <span className={cx('ao-fact__sev', n.sev === 'accent' && 'ao-fact__sev--accent', n.sev === 'danger' && 'ao-fact__sev--danger')} />
                  <div className="ao-fact__main">
                    <div className="ao-fact__label">{n.title}</div>
                    <div className="ao-fact__sub">{n.sub}</div>
                  </div>
                  <div className="ao-fact__value">{n.time}</div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
