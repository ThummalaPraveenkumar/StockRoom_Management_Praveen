import { ChevronRight, Clock } from 'lucide-react';

interface Props {
  item: any;
  onClick?: () => void;
  showDays?: boolean;
  compact?: boolean;
}

const statusBadge: Record<string, string> = {
  ok: 'badge-ok', low: 'badge-low', critical: 'badge-critical', breach: 'badge-breach',
};

export default function StockCard({ item, onClick, showDays = true, compact = false }: Props) {
  const pct = item.parLevelBaseUnits > 0
    ? Math.min(100, (item.quantityBaseUnits / item.parLevelBaseUnits) * 100)
    : 100;

  const daysLeft = item.daysUntilStockout;

  return (
    <div
      className={`stock-card ${item.status}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      role={onClick ? 'button' : undefined}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: compact ? '0.9375rem' : '1rem', lineHeight: 1.2 }}>{item.name}</span>
            <span className={`badge ${statusBadge[item.status]}`}>{item.status}</span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.category}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div className="data-num" style={{ fontSize: '1.0625rem' }}>{item.displayQuantity}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>par {item.displayPar}</div>
          </div>
          {onClick && <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </div>

      <div className="progress-track">
        <div className={`progress-fill ${item.status}`} style={{ width: `${pct}%` }} />
      </div>

      {showDays && daysLeft !== null && daysLeft !== undefined && item.status !== 'ok' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: '0.8125rem' }}>
          <Clock size={12} style={{ color: item.status === 'breach' || item.status === 'critical' ? 'var(--breach)' : 'var(--low)' }} />
          <span style={{ color: item.status === 'breach' || item.status === 'critical' ? 'var(--breach)' : 'var(--low)', fontWeight: 500 }}>
            {daysLeft <= 0 ? 'Out of stock' : `Runs out in ~${daysLeft.toFixed(1)} days`}
          </span>
        </div>
      )}
    </div>
  );
}
