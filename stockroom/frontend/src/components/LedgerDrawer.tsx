import { useQuery } from '@tanstack/react-query';
import { X, TrendingUp, TrendingDown, RotateCcw, Trash2, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';

interface Props {
  propertyId: string;
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  displayQuantity: string;
  status: string;
  onClose: () => void;
}

const TX_META: Record<string, { label: string; sign: string; cls: string; Icon: any }> = {
  receive:  { label: 'Received',  sign: '+', cls: 'tx-receive',  Icon: TrendingUp },
  issue:    { label: 'Issued',    sign: '−', cls: 'tx-issue',    Icon: ArrowRight },
  consume:  { label: 'Consumed',  sign: '−', cls: 'tx-consume',  Icon: TrendingDown },
  waste:    { label: 'Wastage',   sign: '−', cls: 'tx-waste',    Icon: Trash2 },
  adjust:   { label: 'Adjusted',  sign: '±', cls: 'tx-adjust',   Icon: RotateCcw },
};

function fmtQty(qty: number, unit: string) {
  const abs = Math.abs(qty);
  if (unit === 'g')  return abs >= 1000 ? `${(abs/1000).toFixed(2)} kg` : `${abs.toFixed(0)} g`;
  if (unit === 'ml') return abs >= 1000 ? `${(abs/1000).toFixed(2)} L`  : `${abs.toFixed(0)} ml`;
  return `${abs} ${unit}`;
}

function fmtDate(dt: string) {
  const d = new Date(dt);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const statusClass: Record<string, string> = {
  ok: 'badge-ok', low: 'badge-low', critical: 'badge-critical', breach: 'badge-breach',
};

export default function LedgerDrawer({ propertyId, ingredientId, ingredientName, baseUnit, displayQuantity, status, onClose }: Props) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['ledger', propertyId, ingredientId],
    queryFn: () => api.getStockHistory(propertyId, ingredientId),
  });

  // Compute running balance (history is desc, so we accumulate from start)
  const entries = history ?? [];

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
                Transaction Ledger
              </div>
              <h2 style={{ fontWeight: 800, fontSize: '1.25rem', lineHeight: 1.2 }}>{ingredientName}</h2>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '8px 14px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current stock</div>
              <div className="data-num" style={{ fontSize: '1.25rem' }}>{displayQuantity}</div>
            </div>
            <span className={`badge ${statusClass[status]}`}>{status}</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 72 }} />)}
            </div>
          )}

          {!isLoading && entries.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon"><RotateCcw size={22} /></div>
              <p style={{ fontWeight: 600 }}>No transactions yet</p>
              <p style={{ fontSize: '0.875rem', marginTop: 4 }}>Transactions appear here once stock moves.</p>
            </div>
          )}

          {!isLoading && entries.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {Object.entries(TX_META).map(([k, v]) => (
                  <span key={k} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className={v.cls} style={{ fontWeight: 700 }}>●</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{v.label}</span>
                  </span>
                ))}
              </div>

              {entries.map((tx: any, i: number) => {
                const meta = TX_META[tx.transactionType] ?? TX_META.adjust;
                const isIn = tx.quantityBaseUnits > 0;
                return (
                  <div key={tx.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 0',
                    borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--bg)',
                    }}>
                      <meta.Icon size={15} className={meta.cls} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{meta.label}</span>
                        <span className={`data-num ${meta.cls}`} style={{ fontSize: '0.9375rem', flexShrink: 0 }}>
                          {isIn ? '+' : '−'}{fmtQty(tx.quantityBaseUnits, baseUnit)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {tx.recordedByName} · {fmtDate(tx.recordedAt)}
                      </div>
                      {tx.notes && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 3, fontStyle: 'italic' }}>
                          "{tx.notes}"
                        </div>
                      )}
                      {tx.referenceType && tx.referenceType !== 'manual' && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          Ref: {tx.referenceType.replace(/_/g, ' ')} {tx.referenceId ? `· ${tx.referenceId.slice(0,8)}…` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
