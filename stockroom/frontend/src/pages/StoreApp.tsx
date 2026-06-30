import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck, ArrowRight, AlertTriangle, CheckCircle,
  RefreshCw, Wifi, WifiOff, ChevronLeft, Plus, X, Scale, History
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket, joinProperty } from '../lib/socket';
import { getPendingOps, syncPendingOps } from '../lib/offline';
import { useToast } from '../hooks/useToast';
import StockCard from '../components/StockCard';
import { SkeletonList } from '../components/Skeleton';

type Tab = 'receive' | 'issue' | 'wastage' | 'adjust' | 'history';

const TABS: { id: Tab; label: string; Icon: any }[] = [
  { id: 'receive',  label: 'Receive',  Icon: Truck },
  { id: 'issue',    label: 'Issue',    Icon: ArrowRight },
  { id: 'wastage',  label: 'Wastage',  Icon: AlertTriangle },
  { id: 'adjust',   label: 'Adjust',   Icon: Scale },
  { id: 'history',  label: 'History',  Icon: History },
];

export default function StoreApp() {
  const [tab, setTab] = useState<Tab>('receive');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [propertyId, setPropertyId] = useState('');
  const [userId, setUserId] = useState('');
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: properties } = useQuery({ queryKey: ['properties'], queryFn: api.getProperties });
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: api.getUsers });

  useEffect(() => {
    if (properties?.length && !propertyId) setPropertyId(properties[0].id);
  }, [properties]);

  useEffect(() => {
    if (users && propertyId && !userId) {
      const u = users.find((u: any) => u.role === 'store_keeper' && u.property_id === propertyId);
      if (u) setUserId(u.id);
    }
  }, [users, propertyId]);

  useEffect(() => {
    if (!propertyId) return;
    joinProperty(propertyId);
    const socket = getSocket();
    const handler = ({ propertyId: pid, source }: any) => {
      if (pid === propertyId) {
        qc.invalidateQueries({ queryKey: ['stock', propertyId] });
        if (source === 'pos_event') toast('info', 'POS event', 'Ingredients deducted by kitchen');
      }
    };
    socket.on('stock_updated', handler);
    return () => { socket.off('stock_updated', handler); };
  }, [propertyId]);

  useEffect(() => {
    const up = async () => { setIsOnline(true); const { synced } = await syncPendingOps(); if (synced > 0) { toast('success', `${synced} queued operation${synced > 1 ? 's' : ''} synced`); qc.invalidateQueries({ queryKey: ['stock', propertyId] }); } getPendingOps().then(ops => setPendingCount(ops.length)); };
    const down = () => setIsOnline(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    getPendingOps().then(ops => setPendingCount(ops.length));
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, [propertyId]);

  const { data: stock, isLoading } = useQuery({
    queryKey: ['stock', propertyId],
    queryFn: () => api.getStock(propertyId),
    enabled: !!propertyId,
    refetchInterval: 30_000,
  });

  return (
    <div className="mobile-page">
      {/* Top bar */}
      <div style={{ background: '#1D4ED8', color: '#fff', padding: '14px 16px 0', flexShrink: 0, position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Link to="/" style={{ color: 'rgba(255,255,255,0.7)', display: 'flex', padding: 4, borderRadius: 8, transition: 'color 0.12s' }}>
            <ChevronLeft size={20} />
          </Link>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>Store App</div>
            {properties && (
              <select
                style={{ background: 'transparent', color: 'rgba(255,255,255,0.75)', fontSize: '0.75rem', border: 'none', outline: 'none', marginTop: 1, cursor: 'pointer', width: '100%' }}
                value={propertyId} onChange={e => setPropertyId(e.target.value)}
              >
                {properties.map((p: any) => <option key={p.id} value={p.id} style={{ color: '#000' }}>{p.name}</option>)}
              </select>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isOnline
              ? <Wifi size={16} style={{ color: 'rgba(255,255,255,0.5)' }} />
              : <WifiOff size={16} style={{ color: '#FCD34D' }} />
            }
            {pendingCount > 0 && (
              <span style={{ background: '#FCD34D', color: '#78350F', fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                {pendingCount} queued
              </span>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 2, overflowX: 'auto', paddingBottom: 0, scrollbarWidth: 'none' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 14px', background: 'transparent', border: 'none',
              borderBottom: tab === t.id ? '2px solid #fff' : '2px solid transparent',
              color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.5)',
              fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.04em',
              textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'color 0.12s', flexShrink: 0,
            }}>
              <t.Icon size={15} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mobile-scroll" style={{ paddingTop: 16 }}>
        {isLoading && <SkeletonList />}

        {!isLoading && tab === 'receive' && propertyId && userId && (
          <ReceiveDelivery propertyId={propertyId} userId={userId} ingredients={stock ?? []}
            onSuccess={() => { qc.invalidateQueries({ queryKey: ['stock', propertyId] }); toast('success', 'Delivery recorded', 'Stock updated'); }} />
        )}
        {!isLoading && tab === 'issue' && propertyId && userId && (
          <IssueStock propertyId={propertyId} userId={userId} ingredients={stock ?? []}
            onSuccess={() => { qc.invalidateQueries({ queryKey: ['stock', propertyId] }); toast('success', 'Issued to kitchen'); }} />
        )}
        {!isLoading && tab === 'wastage' && propertyId && userId && (
          <RecordWastage propertyId={propertyId} userId={userId} ingredients={stock ?? []}
            onSuccess={() => { qc.invalidateQueries({ queryKey: ['stock', propertyId] }); toast('warning', 'Wastage recorded', 'Deducted from stock'); }} />
        )}
        {!isLoading && tab === 'adjust' && propertyId && userId && (
          <PhysicalCount propertyId={propertyId} userId={userId} ingredients={stock ?? []}
            onSuccess={() => { qc.invalidateQueries({ queryKey: ['stock', propertyId] }); toast('info', 'Stock adjusted', 'Physical count applied'); }} />
        )}
        {tab === 'history' && propertyId && (
          <StockHistory stock={stock ?? []} isLoading={isLoading} />
        )}
      </div>

      {/* Bottom nav */}
      <div className="bottom-nav">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`bottom-nav-item ${tab === t.id ? 'active-store' : ''}`}>
            <t.Icon size={18} />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Receive ──────────────────────────────────────────────────────── */
function ReceiveDelivery({ propertyId, userId, ingredients, onSuccess }: any) {
  const [items, setItems] = useState([{ ingredientId: '', orderedQty: '', receivedQty: '', unit: 'kg', status: 'complete', notes: '' }]);
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: (d: object) => api.receiveDelivery(d),
    onSuccess: () => { setItems([{ ingredientId: '', orderedQty: '', receivedQty: '', unit: 'kg', status: 'complete', notes: '' }]); onSuccess(); },
    onError: (e: any) => setError(e.message),
  });

  const update = (i: number, k: string, v: string) => setItems(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontWeight: 800, fontSize: '1.25rem' }}>Receive Delivery</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 3 }}>Log what arrived. Flag short or damaged items.</p>
      </div>

      {error && <div className="alert-banner danger"><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /><span>{error}</span></div>}

      {items.map((row, i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="section-label" style={{ margin: 0 }}>Item {i + 1}</span>
            {items.length > 1 && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setItems(p => p.filter((_, x) => x !== i))}><X size={14} /></button>}
          </div>

          <div>
            <label className="field-label">Ingredient</label>
            <select className="input" value={row.ingredientId} onChange={e => update(i, 'ingredientId', e.target.value)}>
              <option value="">Select ingredient…</option>
              {ingredients.map((ing: any) => <option key={ing.ingredientId} value={ing.ingredientId}>{ing.name} · {ing.displayQuantity} in stock</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="field-label">Ordered Qty</label>
              <input className="input" type="number" min="0" step="0.1" placeholder="0" value={row.orderedQty} onChange={e => update(i, 'orderedQty', e.target.value)} />
            </div>
            <div>
              <label className="field-label">Received Qty</label>
              <input className="input" type="number" min="0" step="0.1" placeholder="0" value={row.receivedQty} onChange={e => update(i, 'receivedQty', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="field-label">Unit</label>
              <select className="input" value={row.unit} onChange={e => update(i, 'unit', e.target.value)}>
                <option value="kg">kg</option><option value="g">g</option>
                <option value="litre">litre</option><option value="ml">ml</option>
                <option value="piece">piece</option><option value="case">case</option>
                <option value="dozen">dozen</option>
              </select>
            </div>
            <div>
              <label className="field-label">Status</label>
              <select className="input" value={row.status} onChange={e => update(i, 'status', e.target.value)}>
                <option value="complete">Complete ✓</option>
                <option value="partial">Partial</option>
                <option value="short">Short delivery</option>
                <option value="damaged">Damaged</option>
              </select>
            </div>
          </div>

          {row.status !== 'complete' && (
            <div>
              <label className="field-label">Reason / note</label>
              <input className="input" placeholder="e.g. Vendor only had 3 cases" value={row.notes} onChange={e => update(i, 'notes', e.target.value)} />
            </div>
          )}
        </div>
      ))}

      <button onClick={() => setItems(p => [...p, { ingredientId: '', orderedQty: '', receivedQty: '', unit: 'kg', status: 'complete', notes: '' }])}
        style={{ width: '100%', padding: '12px', background: 'transparent', border: '2px dashed var(--border)', borderRadius: 12, color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.12s' }}
        onMouseEnter={e => { (e.currentTarget as any).style.borderColor = '#1D4ED8'; (e.currentTarget as any).style.color = '#1D4ED8'; }}
        onMouseLeave={e => { (e.currentTarget as any).style.borderColor = 'var(--border)'; (e.currentTarget as any).style.color = 'var(--text-muted)'; }}>
        <Plus size={15} /> Add another item
      </button>

      <button className="btn btn-primary btn-full btn-lg" disabled={mutation.isPending} onClick={() => {
        setError('');
        const valid = items.filter(r => r.ingredientId && r.receivedQty);
        if (!valid.length) { setError('Add at least one item with ingredient and received quantity'); return; }
        mutation.mutate({ propertyId, items: valid.map(r => ({ ingredientId: r.ingredientId, orderedQuantity: parseFloat(r.orderedQty) || parseFloat(r.receivedQty), receivedQuantity: parseFloat(r.receivedQty), unit: r.unit, status: r.status, notes: r.notes || undefined })), recordedBy: userId });
      }}>
        {mutation.isPending ? <><RefreshCw size={16} className="animate-spin" /> Recording…</> : <><Truck size={16} /> Record Delivery</>}
      </button>
    </div>
  );
}

/* ─── Issue ────────────────────────────────────────────────────────── */
function IssueStock({ propertyId, userId, ingredients, onSuccess }: any) {
  const [items, setItems] = useState([{ ingredientId: '', qty: '', unit: 'kg' }]);
  const [slipNo, setSlipNo] = useState(`SLIP-${new Date().toISOString().slice(0,10)}`);
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: (d: object) => api.issueStock(d),
    onSuccess: () => { setItems([{ ingredientId: '', qty: '', unit: 'kg' }]); onSuccess(); },
    onError: (e: any) => setError(e.message),
  });
  const update = (i: number, k: string, v: string) => setItems(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontWeight: 800, fontSize: '1.25rem' }}>Issue to Kitchen</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 3 }}>Record stock moving from store to kitchen.</p>
      </div>

      {error && <div className="alert-banner danger"><AlertTriangle size={15} style={{ flexShrink: 0 }} /><span>{error}</span></div>}

      <div>
        <label className="field-label">Issue Slip Number</label>
        <input className="input" value={slipNo} onChange={e => setSlipNo(e.target.value)} />
      </div>

      {items.map((row, i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="section-label" style={{ margin: 0 }}>Item {i + 1}</span>
            {items.length > 1 && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setItems(p => p.filter((_, x) => x !== i))}><X size={14} /></button>}
          </div>
          <div>
            <label className="field-label">Ingredient</label>
            <select className="input" value={row.ingredientId} onChange={e => update(i, 'ingredientId', e.target.value)}>
              <option value="">Select ingredient…</option>
              {ingredients.filter((ing: any) => ing.status !== 'breach').map((ing: any) => (
                <option key={ing.ingredientId} value={ing.ingredientId}>{ing.name} — {ing.displayQuantity}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="field-label">Quantity</label>
              <input className="input" type="number" min="0" step="0.1" placeholder="0" value={row.qty} onChange={e => update(i, 'qty', e.target.value)} />
            </div>
            <div>
              <label className="field-label">Unit</label>
              <select className="input" value={row.unit} onChange={e => update(i, 'unit', e.target.value)}>
                <option value="kg">kg</option><option value="g">g</option>
                <option value="litre">litre</option><option value="ml">ml</option>
                <option value="piece">piece</option><option value="dozen">dozen</option>
              </select>
            </div>
          </div>
        </div>
      ))}

      <button onClick={() => setItems(p => [...p, { ingredientId: '', qty: '', unit: 'kg' }])}
        style={{ width: '100%', padding: '12px', background: 'transparent', border: '2px dashed var(--border)', borderRadius: 12, color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Plus size={15} /> Add item
      </button>

      <button className="btn btn-primary btn-full btn-lg" disabled={mutation.isPending} onClick={() => {
        setError('');
        const valid = items.filter(r => r.ingredientId && r.qty);
        if (!valid.length) { setError('Add at least one item'); return; }
        mutation.mutate({ propertyId, recordedBy: userId, issueSlipNumber: slipNo, items: valid.map(r => ({ ingredientId: r.ingredientId, quantity: parseFloat(r.qty), unit: r.unit })) });
      }}>
        {mutation.isPending ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Issuing…</> : <><ArrowRight size={16} /> Issue to Kitchen</>}
      </button>
    </div>
  );
}

/* ─── Wastage ──────────────────────────────────────────────────────── */
function RecordWastage({ propertyId, userId, ingredients, onSuccess }: any) {
  const [ingredientId, setIngredientId] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('kg');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: (d: object) => api.recordWastage(d),
    onSuccess: () => { setIngredientId(''); setQty(''); setReason(''); onSuccess(); },
    onError: (e: any) => setError(e.message),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontWeight: 800, fontSize: '1.25rem' }}>Record Wastage</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 3 }}>
          Recorded separately from consumption — affects food cost report differently.
        </p>
      </div>

      {error && <div className="alert-banner danger"><AlertTriangle size={15} style={{ flexShrink: 0 }} /><span>{error}</span></div>}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="field-label">Ingredient</label>
          <select className="input" value={ingredientId} onChange={e => setIngredientId(e.target.value)}>
            <option value="">Select ingredient…</option>
            {ingredients.map((ing: any) => <option key={ing.ingredientId} value={ing.ingredientId}>{ing.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="field-label">Quantity wasted</label>
            <input className="input" type="number" min="0" step="0.1" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Unit</label>
            <select className="input" value={unit} onChange={e => setUnit(e.target.value)}>
              <option value="kg">kg</option><option value="g">g</option>
              <option value="litre">litre</option><option value="ml">ml</option><option value="piece">piece</option>
            </select>
          </div>
        </div>
        <div>
          <label className="field-label">Reason</label>
          <select className="input" value={reason} onChange={e => setReason(e.target.value)}>
            <option value="">Select reason…</option>
            <option value="Spoiled - overripe">Spoiled — overripe</option>
            <option value="Expired - past use-by date">Expired — past use-by date</option>
            <option value="Damaged in storage">Damaged in storage</option>
            <option value="Temperature breach">Temperature breach (cold chain)</option>
            <option value="Contamination">Contamination</option>
            <option value="Cooking error">Cooking error</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <button className="btn btn-danger btn-full btn-lg" disabled={mutation.isPending || !ingredientId || !qty || !reason}
        onClick={() => { setError(''); if (!ingredientId || !qty || !reason) { setError('All fields are required'); return; } mutation.mutate({ propertyId, ingredientId, quantity: parseFloat(qty), unit, reason, recordedBy: userId }); }}>
        {mutation.isPending ? <><RefreshCw size={16} /> Recording…</> : <><AlertTriangle size={16} /> Record Wastage</>}
      </button>
    </div>
  );
}

/* ─── Physical Count / Adjust ──────────────────────────────────────── */
function PhysicalCount({ propertyId, userId, ingredients, onSuccess }: any) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('Physical count');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const changed = ingredients.filter((ing: any) => counts[ing.ingredientId] !== undefined && counts[ing.ingredientId] !== '');

  const handleSubmit = async () => {
    if (!changed.length) { setError('Enter a counted quantity for at least one ingredient'); return; }
    setSubmitting(true); setError('');
    try {
      for (const ing of changed) {
        const counted = parseFloat(counts[ing.ingredientId]);
        const diff = counted - ing.quantityBaseUnits;
        if (Math.abs(diff) < 0.001) continue;
        await api.issueStock({
          propertyId, recordedBy: userId, issueSlipNumber: `ADJUST-${Date.now()}`,
          items: [{ ingredientId: ing.ingredientId, quantity: Math.abs(diff), unit: ing.baseUnit }],
          _adjustType: diff > 0 ? 'receive' : 'adjust',
          notes: reason,
        });
      }
      setCounts({}); onSuccess();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontWeight: 800, fontSize: '1.25rem' }}>Physical Count</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 3 }}>
          Enter actual counted quantities. System calculates variance and records an adjustment transaction.
        </p>
      </div>

      {error && <div className="alert-banner danger"><AlertTriangle size={15} style={{ flexShrink: 0 }} /><span>{error}</span></div>}

      <div>
        <label className="field-label">Reason for adjustment</label>
        <input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Weekly physical count" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ingredients.map((ing: any) => {
          const counted = counts[ing.ingredientId];
          const diff = counted ? parseFloat(counted) - ing.quantityBaseUnits : null;
          return (
            <div key={ing.ingredientId} className="card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{ing.name}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>System: {ing.displayQuantity}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {diff !== null && Math.abs(diff) > 0.01 && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: diff > 0 ? 'var(--ok)' : 'var(--breach)' }}>
                    {diff > 0 ? '+' : ''}{formatBase(diff, ing.baseUnit)}
                  </span>
                )}
                <input
                  className="input"
                  type="number" min="0" step="0.01"
                  placeholder="Count…"
                  value={counts[ing.ingredientId] ?? ''}
                  onChange={e => setCounts(p => ({ ...p, [ing.ingredientId]: e.target.value }))}
                  style={{ width: 100, textAlign: 'right' }}
                />
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', width: 24 }}>{ing.baseUnit}</span>
              </div>
            </div>
          );
        })}
      </div>

      {changed.length > 0 && (
        <div className="alert-banner info" style={{ fontSize: '0.8125rem' }}>
          <CheckCircle size={14} style={{ flexShrink: 0 }} />
          <span>{changed.length} ingredient{changed.length > 1 ? 's' : ''} will be adjusted</span>
        </div>
      )}

      <button className="btn btn-primary btn-full btn-lg" disabled={submitting || !changed.length} onClick={handleSubmit}>
        {submitting ? <><RefreshCw size={16} /> Applying…</> : <><Scale size={16} /> Apply Physical Count</>}
      </button>
    </div>
  );
}

/* ─── History ──────────────────────────────────────────────────────── */
function StockHistory({ stock, isLoading }: any) {
  const [search, setSearch] = useState('');
  const categories = [...new Set((stock as any[]).map((s: any) => s.category))];
  const [cat, setCat] = useState('All');

  const filtered = stock.filter((s: any) =>
    (cat === 'All' || s.category === cat) &&
    (!search || s.name.toLowerCase().includes(search.toLowerCase()))
  );

  if (isLoading) return <SkeletonList />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ fontWeight: 800, fontSize: '1.25rem' }}>Current Stock</h2>

      <input className="input" placeholder="Search ingredients…" value={search} onChange={e => setSearch(e.target.value)} />

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
        {['All', ...categories].map(c => (
          <button key={c} onClick={() => setCat(c)}
            className={`tag-pill ${cat === c ? 'active' : ''}`}
            style={cat === c ? { background: '#1D4ED8', color: '#fff', borderColor: '#1D4ED8' } : {}}>
            {c}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((item: any) => <StockCard key={item.ingredientId} item={item} showDays compact />)}
      </div>
    </div>
  );
}

function formatBase(qty: number, baseUnit: string): string {
  const abs = Math.abs(qty);
  if (baseUnit === 'g')  return abs >= 1000 ? `${(abs/1000).toFixed(2)} kg` : `${abs.toFixed(0)} g`;
  if (baseUnit === 'ml') return abs >= 1000 ? `${(abs/1000).toFixed(2)} L`  : `${abs.toFixed(0)} ml`;
  return `${abs} ${baseUnit}`;
}
