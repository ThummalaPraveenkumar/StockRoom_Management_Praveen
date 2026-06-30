import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3, AlertTriangle, CheckCircle,
  TrendingDown, RefreshCw, Settings,
  Search, Edit3, Check, X, Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket, joinProperty } from '../lib/socket';
import { useToast } from '../hooks/useToast';
import { SkeletonList } from '../components/Skeleton';

type Section = 'overview' | 'alerts' | 'approvals' | 'reconciliation' | 'parlevel';

const NAV: { id: Section; label: string; Icon: any }[] = [
  { id: 'overview',       label: 'Overview',       Icon: BarChart3    },
  { id: 'alerts',         label: 'Stock Alerts',   Icon: AlertTriangle },
  { id: 'approvals',      label: 'Approvals',      Icon: CheckCircle  },
  { id: 'reconciliation', label: 'Reconciliation', Icon: TrendingDown },
  { id: 'parlevel',       label: 'Par Levels',     Icon: Settings     },
];

export default function ManagerDashboard() {
  const [section, setSection]     = useState<Section>('overview');
  const [propertyId, setPropertyId] = useState('');
  const [period, setPeriod]       = useState(7);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: properties } = useQuery({ queryKey: ['properties'], queryFn: api.getProperties });
  useEffect(() => { if (properties?.length && !propertyId) setPropertyId(properties[0].id); }, [properties]);

  useEffect(() => {
    if (!propertyId) return;
    joinProperty(propertyId);
    const socket = getSocket();
    const handler = ({ propertyId: pid }: any) => {
      if (pid !== propertyId) return;
      qc.invalidateQueries({ queryKey: ['dashboard', propertyId] });
      qc.invalidateQueries({ queryKey: ['alerts', propertyId] });
      toast('info', 'Live update', 'Stock changed — dashboard refreshed.');
    };
    socket.on('stock_updated', handler);
    return () => { socket.off('stock_updated', handler); };
  }, [propertyId]);

  const { data: dash, isLoading } = useQuery({
    queryKey: ['dashboard', propertyId, period],
    queryFn: () => api.getDashboard(propertyId, period),
    enabled: !!propertyId,
    refetchInterval: 60_000,
  });

  const { data: alerts } = useQuery({
    queryKey: ['alerts', propertyId],
    queryFn: () => api.getAlerts(propertyId),
    enabled: !!propertyId,
  });

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <nav className="sidebar">
        <div style={{ padding: '20px 16px 12px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>← Home</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <div style={{ width: 32, height: 32, background: '#6D28D9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BarChart3 size={16} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.9375rem' }}>Manager</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>F&amp;B Dashboard</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '0 8px 12px' }}>
          <p className="section-label" style={{ padding: '0 8px' }}>Property</p>
          <select className="input" style={{ margin: '4px 8px', width: 'calc(100% - 16px)', fontSize: '0.875rem' }}
            value={propertyId} onChange={e => setPropertyId(e.target.value)}>
            {(properties ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div style={{ flex: 1, padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setSection(n.id)}
              className={`sidebar-item ${section === n.id ? 'active' : ''}`}>
              <n.Icon size={16} />
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.id === 'alerts'    && (alerts ?? []).length > 0          && <span className="badge badge-breach">{(alerts ?? []).length}</span>}
              {n.id === 'approvals' && (dash?.pendingApprovals ?? 0) > 0  && <span className="badge badge-low">{dash?.pendingApprovals}</span>}
            </button>
          ))}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Arjun Kumar · F&amp;B Manager
        </div>
      </nav>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
          {/* Page header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <h1 style={{ fontWeight: 800, fontSize: '1.375rem', marginBottom: 4 }}>
                {NAV.find(n => n.id === section)?.label}
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {properties?.find((p: any) => p.id === propertyId)?.name ?? '…'}
                {section === 'overview' && ` · last ${period} days`}
              </p>
            </div>
            {section === 'overview' && (
              <div style={{ display: 'flex', gap: 6 }}>
                {[7, 14, 30].map(d => (
                  <button key={d} onClick={() => setPeriod(d)}
                    className={`btn btn-sm ${period === d ? 'btn-violet' : 'btn-ghost'}`}>{d}d</button>
                ))}
              </div>
            )}
          </div>

          {section === 'overview'       && <OverviewSection  dash={dash} alerts={alerts ?? []} isLoading={isLoading} />}
          {section === 'alerts'         && <AlertsSection    alerts={alerts ?? []} stock={dash?.stockSummary ?? []} />}
          {section === 'approvals'      && <ApprovalsSection propertyId={propertyId} onChange={() => qc.invalidateQueries({ queryKey: ['dashboard', propertyId] })} />}
          {section === 'reconciliation' && <ReconcileSection propertyId={propertyId} />}
          {section === 'parlevel'       && <ParLevelSection  propertyId={propertyId} />}
        </div>
      </main>
    </div>
  );
}

/* ─── Overview ───────────────────────────────────────────────────────── */
function OverviewSection({ dash, alerts, isLoading }: any) {
  if (isLoading) return <SkeletonList count={4} />;
  if (!dash) return null;

  const kpis = [
    { label: 'Food Cost %',   value: `${(dash.foodCostPct ?? 0).toFixed(1)}%`,           color: dash.foodCostPct > 35 ? 'var(--breach)' : 'var(--ok)',        sub: 'target ≤35%' },
    { label: 'Items Low/Out', value: `${alerts.length}`,                                  color: alerts.length ? 'var(--critical)' : 'var(--ok)',              sub: 'need attention' },
    { label: 'Wastage Cost',  value: `₹${(dash.wastageCost ?? 0).toLocaleString()}`,      color: 'var(--low)',                                                  sub: 'this period' },
    { label: 'Pending Orders',value: `${dash.pendingApprovals ?? 0}`,                     color: (dash.pendingApprovals ?? 0) > 0 ? 'var(--low)' : 'var(--ok)', sub: 'requests awaiting' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        {kpis.map(k => (
          <div key={k.label} className="kpi-card">
            <div className="data-num" style={{ fontSize: '2rem', color: k.color }}>{k.value}</div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: 4 }}>{k.label}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {(dash.costByCategory ?? []).length > 0 && (
        <div className="card">
          <p className="section-label" style={{ marginBottom: 14 }}>Cost by Category</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(dash.costByCategory as any[]).map((c: any) => {
              const pct = dash.totalCost > 0 ? c.cost / dash.totalCost * 100 : 0;
              return (
                <div key={c.category}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{c.category}</span>
                    <span className="data-num" style={{ fontSize: '0.875rem' }}>₹{c.cost.toLocaleString()} · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: '#6D28D9' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="card">
          <p className="section-label" style={{ marginBottom: 12 }}>Top Consumed</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(dash.topConsumed ?? []).slice(0, 6).map((r: any, i: number) => (
              <div key={r.ingredientId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="data-num" style={{ width: 18, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{i+1}</span>
                <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>{r.name}</span>
                <span className="data-num" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {r.totalQty?.toFixed(0)}{r.baseUnit}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <p className="section-label" style={{ marginBottom: 12 }}>Stock Health</p>
          {[
            { label: 'In Stock (OK)', key: 'ok',       color: 'var(--ok)' },
            { label: 'Low Stock',     key: 'low',      color: 'var(--low)' },
            { label: 'Critical',      key: 'critical', color: 'var(--critical)' },
            { label: 'Out of Stock',  key: 'breach',   color: 'var(--breach)' },
          ].map(s => {
            const count = (dash.stockSummary ?? []).filter((i: any) => i.status === s.key).length;
            const total = (dash.stockSummary ?? []).length;
            const pct   = total > 0 ? count / total * 100 : 0;
            return (
              <div key={s.key} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{s.label}</span>
                  <span className="data-num" style={{ fontSize: '0.8125rem', color: s.color }}>{count}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: s.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Alerts ─────────────────────────────────────────────────────────── */
function AlertsSection({ alerts, stock }: any) {
  const [search, setSearch] = useState('');
  const filtered = (alerts as any[]).filter((a: any) =>
    !search || a.message?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input className="input" placeholder="Search alerts…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 38 }} />
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><CheckCircle size={24} /></div>
          <p style={{ fontWeight: 600 }}>No active alerts</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>All stock within thresholds.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((a: any) => {
          const item = (stock as any[]).find((s: any) => s.ingredientId === a.ingredientId);
          const sev  = a.alertType === 'stockout' || a.alertType === 'breach' ? 'breach' : a.alertType === 'critical_stock' ? 'critical' : 'low';
          return (
            <div key={a.id} className="card" style={{ borderLeft: `4px solid var(--${sev})`, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `var(--${sev}-bg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <AlertTriangle size={16} style={{ color: `var(--${sev})` }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 3 }}>{a.ingredientName ?? a.message}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>{a.message}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {item && <span className="badge badge-gray">{item.displayQuantity} in stock</span>}
                  {a.daysUntilStockout != null && (
                    <span className={`badge badge-${a.daysUntilStockout <= 1 ? 'breach' : 'low'}`}>
                      {a.daysUntilStockout < 1 ? 'Stockout now' : `~${a.daysUntilStockout}d left`}
                    </span>
                  )}
                  <span className={`badge badge-${sev}`}>{a.alertType?.replace(/_/g, ' ')}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Approvals ───────────────────────────────────────────────────────── */
function ApprovalsSection({ propertyId, onChange }: any) {
  const { toast } = useToast();
  const { data: requests, refetch } = useQuery({
    queryKey: ['purchase-requests', propertyId],
    queryFn: () => api.getPurchaseRequests({ propertyId }),
    enabled: !!propertyId,
  });

  const approveMut = useMutation({
    mutationFn: ({ id, status }: any) => api.approvePurchaseRequest(id, status),
    onSuccess: (_, { status }) => {
      refetch(); onChange();
      toast(status === 'approved' ? 'success' : 'warning', status === 'approved' ? 'Request approved' : 'Request rejected');
    },
  });

  const pending  = (requests ?? []).filter((r: any) => r.status === 'pending');
  const resolved = (requests ?? []).filter((r: any) => r.status !== 'pending');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {pending.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><CheckCircle size={24} /></div>
          <p style={{ fontWeight: 600 }}>All requests reviewed</p>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <p className="section-label">Awaiting approval ({pending.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {pending.map((r: any) => (
              <RequestCard key={r.id} request={r}
                onApprove={() => approveMut.mutate({ id: r.id, status: 'approved' })}
                onReject={()  => approveMut.mutate({ id: r.id, status: 'rejected' })}
                isPending={approveMut.isPending} />
            ))}
          </div>
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <p className="section-label">Resolved</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {resolved.map((r: any) => (
              <div key={r.id} className="card-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.75 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.ingredientName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.quantity} {r.unit} · {r.raisedByName}</div>
                </div>
                <span className={`badge badge-${r.status === 'approved' || r.status === 'ordered' ? 'ok' : 'breach'}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RequestCard({ request: r, onApprove, onReject, isPending }: any) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderLeft: '4px solid var(--low)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{r.ingredientName}</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            {r.quantity} {r.unit} · by {r.raisedByName ?? 'chef'}
          </div>
        </div>
        <span className="badge badge-low">pending</span>
      </div>
      {r.notes && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          "{r.notes}"
        </div>
      )}
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Clock size={12} />{new Date(r.created_at).toLocaleString()}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-teal" style={{ flex: 1 }} disabled={isPending} onClick={onApprove}><Check size={14} /> Approve</button>
        <button className="btn btn-ghost" style={{ flex: 1, borderColor: 'var(--breach)', color: 'var(--breach)' }} disabled={isPending} onClick={onReject}><X size={14} /> Reject</button>
      </div>
    </div>
  );
}

/* ─── Reconciliation ─────────────────────────────────────────────────── */
function ReconcileSection({ propertyId }: any) {
  const today      = new Date();
  const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const todayStr   = today.toISOString().split('T')[0];

  const [from, setFrom] = useState(firstMonth);
  const [to,   setTo]   = useState(todayStr);
  const [run,  setRun]  = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reconcile', propertyId, from, to],
    queryFn: () => api.getReconciliation(propertyId, from, to),
    enabled: run && !!propertyId,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label className="field-label">From</label>
          <input className="input" type="date" value={from} onChange={e => { setFrom(e.target.value); setRun(false); }} />
        </div>
        <div>
          <label className="field-label">To</label>
          <input className="input" type="date" value={to} onChange={e => { setTo(e.target.value); setRun(false); }} />
        </div>
        <button className="btn btn-violet" onClick={() => { setRun(true); refetch(); }}>
          {isLoading ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Running…</> : 'Run Reconciliation'}
        </button>
      </div>

      {!run && (
        <div className="empty-state">
          <div className="empty-state-icon"><TrendingDown size={24} /></div>
          <p style={{ fontWeight: 600 }}>Set date range and run reconciliation</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Compares theoretical usage (recipe × service logs) against actual consumption.</p>
        </div>
      )}

      {data && !isLoading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {[
              { label: 'Theoretical', value: `₹${(data.theoreticalCost ?? 0).toLocaleString()}`,       color: 'var(--text-primary)' },
              { label: 'Actual',      value: `₹${(data.actualCost ?? 0).toLocaleString()}`,             color: 'var(--text-primary)' },
              { label: 'Variance',    value: `₹${Math.abs(data.variance ?? 0).toLocaleString()}`,       color: Math.abs(data.variance ?? 0) > 5000 ? 'var(--breach)' : 'var(--ok)' },
              { label: 'Variance %',  value: `${(data.variancePct ?? 0).toFixed(1)}%`,                  color: Math.abs(data.variancePct ?? 0) > 5 ? 'var(--breach)' : 'var(--ok)' },
            ].map(k => (
              <div key={k.label} className="kpi-card">
                <div className="data-num" style={{ fontSize: '1.625rem', color: k.color }}>{k.value}</div>
                <div style={{ fontWeight: 500, fontSize: '0.8125rem', marginTop: 4 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {(data.items ?? []).length > 0 && (
            <div className="card" style={{ overflowX: 'auto' }}>
              <p className="section-label" style={{ marginBottom: 12 }}>Line Items</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Ingredient', 'Theoretical', 'Actual', 'Variance', 'Δ%'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Ingredient' ? 'left' : 'right', padding: '8px 10px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.items as any[]).map((row: any) => {
                    const varPct = row.theoreticalCost > 0 ? (row.variance / row.theoreticalCost * 100) : 0;
                    const bad    = Math.abs(varPct) > 10;
                    return (
                      <tr key={row.ingredientId} style={{ borderBottom: '1px solid var(--border)', background: bad ? 'var(--breach-bg)' : 'transparent' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 500 }}>{row.name}</td>
                        <td className="data-num" style={{ textAlign: 'right', padding: '8px 10px' }}>₹{row.theoreticalCost?.toFixed(0)}</td>
                        <td className="data-num" style={{ textAlign: 'right', padding: '8px 10px' }}>₹{row.actualCost?.toFixed(0)}</td>
                        <td className="data-num" style={{ textAlign: 'right', padding: '8px 10px', color: row.variance > 0 ? 'var(--breach)' : 'var(--ok)' }}>
                          {row.variance > 0 ? '+' : ''}₹{row.variance?.toFixed(0)}
                        </td>
                        <td className="data-num" style={{ textAlign: 'right', padding: '8px 10px', color: bad ? 'var(--breach)' : 'var(--text-secondary)' }}>
                          {varPct > 0 ? '+' : ''}{varPct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Par Level Management ───────────────────────────────────────────── */
function ParLevelSection({ propertyId }: any) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<string, { parLevel: string; reorderPoint: string }>>({});
  const [search, setSearch] = useState('');

  const { data: stock, isLoading } = useQuery({
    queryKey: ['stock', propertyId],
    queryFn: () => api.getStock(propertyId),
    enabled: !!propertyId,
  });

  const updateMut = useMutation({
    mutationFn: ({ ingredientId, parLevel, reorderPoint }: any) =>
      api.updateParLevel(propertyId, ingredientId, parLevel, reorderPoint),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock', propertyId] });
      setEditing(null);
      toast('success', 'Par level saved', 'Alerts will recalculate automatically');
    },
    onError: (e: any) => toast('error', 'Save failed', e.message),
  });

  if (isLoading) return <SkeletonList />;

  const filtered = (stock ?? []).filter((s: any) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (item: any) => {
    setEditing(item.ingredientId);
    setVals(v => ({ ...v, [item.ingredientId]: { parLevel: item.parLevel?.toString() ?? '', reorderPoint: item.reorderPoint?.toString() ?? '' } }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '12px 14px', fontSize: '0.875rem', color: '#92400E', display: 'flex', gap: 8 }}>
        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        Par level = daily-use × lead days. Below 25% of par → critical. Below 0 → breach (stockout).
      </div>
      <div style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input className="input" placeholder="Search ingredients…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 38 }} />
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Ingredient', 'Category', 'Current Stock', 'Par Level', 'Reorder Point', 'Status', ''].map(h => (
                <th key={h} style={{ textAlign: h === 'Ingredient' || h === 'Category' ? 'left' : 'right', padding: '10px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item: any) => {
              const isEdit = editing === item.ingredientId;
              const v      = vals[item.ingredientId] ?? { parLevel: '', reorderPoint: '' };
              return (
                <tr key={item.ingredientId} style={{ borderBottom: '1px solid var(--border)', background: isEdit ? 'var(--surface-2)' : 'transparent' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.name}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{item.category}</td>
                  <td className="data-num" style={{ textAlign: 'right', padding: '10px 12px' }}>{item.displayQuantity}</td>
                  <td style={{ textAlign: 'right', padding: '10px 8px' }}>
                    {isEdit ? (
                      <input className="input" type="number" style={{ width: 90, textAlign: 'right', padding: '4px 8px', fontSize: '0.875rem' }}
                        value={v.parLevel} onChange={e => setVals(vv => ({ ...vv, [item.ingredientId]: { ...v, parLevel: e.target.value } }))} />
                    ) : (
                      <span className="data-num">{item.parLevel?.toFixed(0) ?? '—'} {item.baseUnit}</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 8px' }}>
                    {isEdit ? (
                      <input className="input" type="number" style={{ width: 90, textAlign: 'right', padding: '4px 8px', fontSize: '0.875rem' }}
                        value={v.reorderPoint} onChange={e => setVals(vv => ({ ...vv, [item.ingredientId]: { ...v, reorderPoint: e.target.value } }))} />
                    ) : (
                      <span className="data-num">{item.reorderPoint?.toFixed(0) ?? '—'} {item.baseUnit}</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                    <span className={`badge badge-${item.status}`}>{item.status}</span>
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    {isEdit ? (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button className="btn btn-sm btn-teal" disabled={updateMut.isPending}
                          onClick={() => updateMut.mutate({ ingredientId: item.ingredientId, parLevel: parseFloat(v.parLevel), reorderPoint: parseFloat(v.reorderPoint) })}>
                          <Check size={12} />
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setEditing(null)}><X size={12} /></button>
                      </div>
                    ) : (
                      <button className="btn btn-sm btn-ghost" onClick={() => startEdit(item)}><Edit3 size={12} /></button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
