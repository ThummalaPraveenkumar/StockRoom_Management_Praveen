import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, Building2, AlertTriangle, CheckCircle,
  RefreshCw, Plus, Package,
  Truck, ClipboardList
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useToast } from '../hooks/useToast';
import { SkeletonList } from '../components/Skeleton';

type Section = 'chain' | 'requests' | 'orders' | 'create';

const NAV: { id: Section; label: string; Icon: any }[] = [
  { id: 'chain',    label: 'Chain Stock',   Icon: Building2     },
  { id: 'requests', label: 'Approved',      Icon: ClipboardList },
  { id: 'orders',   label: 'Orders',        Icon: Truck         },
  { id: 'create',   label: 'New Order',     Icon: Plus          },
];

export default function PurchaseConsole() {
  const [section, setSection] = useState<Section>('chain');
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    const handler = () => {
      qc.invalidateQueries({ queryKey: ['chain'] });
      qc.invalidateQueries({ queryKey: ['purchase-requests-all'] });
      toast('info', 'Chain updated', 'Stock levels changed across properties');
    };
    socket.on('stock_updated', handler);
    return () => { socket.off('stock_updated', handler); };
  }, []);

  const { data: chain, isLoading: chainLoading } = useQuery({
    queryKey: ['chain'],
    queryFn: api.getChainView,
    refetchInterval: 60_000,
  });

  const { data: allRequests } = useQuery({
    queryKey: ['purchase-requests-all'],
    queryFn: () => api.getPurchaseRequests({}),
    refetchInterval: 30_000,
  });

  const approvedRequests = (allRequests ?? []).filter((r: any) => r.status === 'approved');
  const pendingOrdersCount = (allRequests ?? []).filter((r: any) => r.status === 'approved').length;

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <nav className="sidebar">
        <div style={{ padding: '20px 16px 12px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>← Home</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <div style={{ width: 32, height: 32, background: '#B45309', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShoppingCart size={16} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.9375rem' }}>Purchase</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Chain Console</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '0 8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setSection(n.id)}
              className={`sidebar-item ${section === n.id ? 'active-amber' : ''}`}>
              <n.Icon size={16} />
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.id === 'requests' && pendingOrdersCount > 0 && <span className="badge badge-low">{pendingOrdersCount}</span>}
            </button>
          ))}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Meena Iyer · Purchase Manager
        </div>
      </nav>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <h1 style={{ fontWeight: 800, fontSize: '1.375rem', marginBottom: 4 }}>
                {NAV.find(n => n.id === section)?.label}
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                All properties · chain-wide view
              </p>
            </div>
          </div>

          {section === 'chain'    && <ChainStockSection chain={chain} isLoading={chainLoading} />}
          {section === 'requests' && <ApprovedRequestsSection requests={approvedRequests} onRefresh={() => qc.invalidateQueries({ queryKey: ['purchase-requests-all'] })} />}
          {section === 'orders'   && <OrdersSection />}
          {section === 'create'   && <CreateOrderSection approvedRequests={approvedRequests} onSuccess={() => { qc.invalidateQueries({ queryKey: ['purchase-requests-all'] }); setSection('orders'); }} />}
        </div>
      </main>
    </div>
  );
}

/* ─── Chain Stock ────────────────────────────────────────────────────── */
function ChainStockSection({ chain, isLoading }: any) {
  if (isLoading) return <SkeletonList count={4} />;
  if (!chain) return null;

  const properties: any[] = chain.properties ?? [];
  const chainStock: any[] = chain.stockItems ?? [];

  const healthColor = (ok: number, total: number) => {
    const pct = total ? ok / total * 100 : 100;
    return pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--low)' : 'var(--breach)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Property health cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {properties.map((p: any) => {
          const items   = chainStock.filter((s: any) => s.propertyId === p.id);
          const ok      = items.filter((s: any) => s.status === 'ok').length;
          const low     = items.filter((s: any) => s.status === 'low').length;
          const crit    = items.filter((s: any) => s.status === 'critical').length;
          const breach  = items.filter((s: any) => s.status === 'breach').length;
          const color   = healthColor(ok, items.length);
          return (
            <div key={p.id} className="card" style={{ borderTop: `4px solid ${color}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{p.city ?? 'Property'}</div>
                </div>
                <div style={{ width: 36, height: 36, background: '#FEF3C7', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={16} style={{ color: '#B45309' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ label: 'OK', val: ok, color: 'var(--ok)' }, { label: 'Low', val: low, color: 'var(--low)' }, { label: 'Crit', val: crit, color: 'var(--critical)' }, { label: 'Out', val: breach, color: 'var(--breach)' }].map(s => (
                  <div key={s.label} style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
                    <div className="data-num" style={{ fontSize: '1.125rem', color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chain-wide critical items */}
      {chainStock.filter((s: any) => s.status === 'critical' || s.status === 'breach').length > 0 && (
        <div className="card">
          <p className="section-label" style={{ marginBottom: 12 }}>
            Needs Immediate Attention ({chainStock.filter((s: any) => s.status === 'critical' || s.status === 'breach').length} items)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chainStock
              .filter((s: any) => s.status === 'critical' || s.status === 'breach')
              .sort((a: any) => (a.status === 'breach' ? -1 : 1))
              .map((s: any) => (
                <div key={`${s.propertyId}-${s.ingredientId}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, background: s.status === 'breach' ? 'var(--breach-bg)' : 'var(--critical-bg)', border: `1px solid var(--${s.status}-border)` }}>
                  <AlertTriangle size={14} style={{ color: `var(--${s.status})`, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}> · {s.propertyName}</span>
                  </div>
                  <span className="data-num" style={{ fontSize: '0.8125rem', color: `var(--${s.status})` }}>{s.displayQuantity}</span>
                  <span className={`badge badge-${s.status}`}>{s.status}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Full chain stock table */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <p className="section-label" style={{ marginBottom: 12 }}>All Stock Items</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Ingredient', 'Property', 'Category', 'Stock', 'Par Level', 'Status'].map(h => (
                <th key={h} style={{ textAlign: h === 'Ingredient' || h === 'Property' || h === 'Category' ? 'left' : 'right', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chainStock.sort((a: any, b: any) => {
              const ord = { breach: 0, critical: 1, low: 2, ok: 3 };
              return (ord[a.status as keyof typeof ord] ?? 3) - (ord[b.status as keyof typeof ord] ?? 3);
            }).map((s: any) => (
              <tr key={`${s.propertyId}-${s.ingredientId}`} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 12px', fontWeight: 500 }}>{s.name}</td>
                <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{s.propertyName}</td>
                <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{s.category}</td>
                <td className="data-num" style={{ textAlign: 'right', padding: '8px 12px' }}>{s.displayQuantity}</td>
                <td className="data-num" style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)' }}>
                  {s.parLevel ? `${s.parLevel.toFixed(0)} ${s.baseUnit}` : '—'}
                </td>
                <td style={{ textAlign: 'right', padding: '8px 12px' }}>
                  <span className={`badge badge-${s.status}`}>{s.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Approved Requests ──────────────────────────────────────────────── */
function ApprovedRequestsSection({ requests }: any) {
  if (requests.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><CheckCircle size={24} /></div>
        <p style={{ fontWeight: 600 }}>No approved requests awaiting order</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Requests approved by F&amp;B managers will appear here.</p>
      </div>
    );
  }

  // Group by property
  const byProperty = requests.reduce((acc: any, r: any) => {
    const key = r.propertyId ?? 'unknown';
    if (!acc[key]) acc[key] = { name: r.propertyName ?? 'Unknown', items: [] };
    acc[key].items.push(r);
    return acc;
  }, {} as Record<string, { name: string; items: any[] }>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 14px', fontSize: '0.875rem', color: '#92400E', display: 'flex', gap: 8 }}>
        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        {requests.length} approved request{requests.length > 1 ? 's' : ''} waiting to be converted into purchase orders.
      </div>

      {Object.entries(byProperty).map(([pid, group]: [string, any]) => (
        <div key={pid}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Building2 size={15} style={{ color: '#B45309' }} />
            <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{group.name}</span>
            <span className="badge badge-gray">{group.items.length} items</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {group.items.map((r: any) => (
              <div key={r.id} className="card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12, borderLeft: '4px solid var(--ok)' }}>
                <div style={{ width: 32, height: 32, background: '#F0FDF4', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Package size={14} style={{ color: 'var(--ok)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{r.ingredientName}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {r.quantity} {r.unit}
                    {r.raisedByName && ` · by ${r.raisedByName}`}
                    {r.notes && ` · "${r.notes}"`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-ok">approved</span>
                  {r.vendorName && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{r.vendorName}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Orders List ────────────────────────────────────────────────────── */
function OrdersSection() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => api.getPurchaseOrders({}),
    refetchInterval: 30_000,
  });

  if (isLoading) return <SkeletonList />;

  if (!(orders?.length)) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Truck size={24} /></div>
        <p style={{ fontWeight: 600 }}>No purchase orders yet</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Create your first order from the New Order tab.</p>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    draft: 'gray', sent: 'low', partial: 'low', delivered: 'ok', cancelled: 'breach',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {(orders as any[]).map((o: any) => (
        <div key={o.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{o.poNumber ?? o.id.slice(0, 8)}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {o.vendorName ?? 'Vendor'} · {o.propertyName ?? 'Property'}
              </div>
            </div>
            <span className={`badge badge-${statusColor[o.status] ?? 'gray'}`}>{o.status}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {o.totalAmount && <span className="data-num" style={{ fontSize: '0.875rem' }}>₹{o.totalAmount.toLocaleString()}</span>}
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {o.itemCount ?? '?'} item{o.itemCount !== 1 ? 's' : ''}
            </span>
            {o.expectedDelivery && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Expected {new Date(o.expectedDelivery).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Create Order ───────────────────────────────────────────────────── */
function CreateOrderSection({ approvedRequests, onSuccess }: any) {
  const { toast } = useToast();
  const { data: properties } = useQuery({ queryKey: ['properties'], queryFn: api.getProperties });
  const [propertyId, setPropertyId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [selectedReqs, setSelectedReqs] = useState<string[]>([]);
  const [items, setItems] = useState<{ ingredientId: string; name: string; quantity: string; unit: string; unitPrice: string }[]>([]);

  const propRequests = approvedRequests.filter((r: any) => !propertyId || r.propertyId === propertyId);

  const toggleReq = (r: any) => {
    setSelectedReqs(prev => prev.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id]);
    setItems(prev => {
      const exists = prev.find(i => i.ingredientId === r.ingredientId);
      if (exists) return prev.filter(i => i.ingredientId !== r.ingredientId);
      return [...prev, { ingredientId: r.ingredientId, name: r.ingredientName, quantity: r.quantity?.toString() ?? '', unit: r.unit ?? 'kg', unitPrice: '' }];
    });
  };

  const addManualItem = () =>
    setItems(prev => [...prev, { ingredientId: '', name: '', quantity: '', unit: 'kg', unitPrice: '' }]);

  const updateItem = (i: number, field: string, value: string) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const createMut = useMutation({
    mutationFn: (data: object) => api.createPurchaseOrder(data),
    onSuccess: () => {
      toast('success', 'Purchase order created', 'Vendor order raised and saved');
      onSuccess();
    },
    onError: (e: any) => toast('error', 'Create failed', e.message),
  });

  const submit = () => {
    if (!propertyId || !vendorName || items.length === 0) {
      toast('warning', 'Missing fields', 'Fill in property, vendor, and at least one item');
      return;
    }
    createMut.mutate({
      propertyId, vendorName, expectedDelivery: expectedDelivery || null,
      items: items.map(i => ({ ingredientId: i.ingredientId, quantity: parseFloat(i.quantity), unit: i.unit, unitPrice: parseFloat(i.unitPrice) || 0 })),
      linkedRequestIds: selectedReqs,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Order details */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p className="section-label">Order Details</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="field-label">Property</label>
            <select className="input" value={propertyId} onChange={e => setPropertyId(e.target.value)}>
              <option value="">Select property…</option>
              {(properties ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Vendor</label>
            <input className="input" placeholder="e.g. Metro Cash &amp; Carry" value={vendorName} onChange={e => setVendorName(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="field-label">Expected Delivery</label>
          <input className="input" type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} style={{ maxWidth: 200 }} />
        </div>
      </div>

      {/* Approved requests to include */}
      {propRequests.length > 0 && (
        <div className="card">
          <p className="section-label" style={{ marginBottom: 10 }}>Include from approved requests</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {propRequests.map((r: any) => (
              <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, background: selectedReqs.includes(r.id) ? '#F0FDF4' : 'var(--surface-2)', border: `1px solid ${selectedReqs.includes(r.id) ? 'var(--ok-border)' : 'var(--border)'}`, transition: 'all 0.12s' }}>
                <input type="checkbox" checked={selectedReqs.includes(r.id)} onChange={() => toggleReq(r)} style={{ width: 16, height: 16, accentColor: 'var(--ok)', cursor: 'pointer' }} />
                <span style={{ flex: 1, fontWeight: 500, fontSize: '0.875rem' }}>{r.ingredientName}</span>
                <span className="data-num" style={{ fontSize: '0.8125rem' }}>{r.quantity} {r.unit}</span>
                {r.propertyName && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.propertyName}</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Items to order */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p className="section-label" style={{ margin: 0 }}>Order Items ({items.length})</p>
          <button className="btn btn-sm btn-ghost" onClick={addManualItem}><Plus size={13} /> Add item</button>
        </div>

        {items.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Select from approved requests above or add items manually
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'center', padding: '10px', background: 'var(--surface-2)', borderRadius: 10 }}>
              <input className="input" placeholder="Ingredient name" value={item.name}
                onChange={e => updateItem(idx, 'name', e.target.value)} style={{ fontSize: '0.875rem' }} />
              <input className="input" type="number" placeholder="Qty" value={item.quantity}
                onChange={e => updateItem(idx, 'quantity', e.target.value)} style={{ fontSize: '0.875rem' }} />
              <select className="input" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} style={{ fontSize: '0.875rem' }}>
                <option>kg</option><option>g</option><option>litre</option><option>piece</option><option>case</option>
              </select>
              <input className="input" type="number" placeholder="₹/unit" value={item.unitPrice}
                onChange={e => updateItem(idx, 'unitPrice', e.target.value)} style={{ fontSize: '0.875rem' }} />
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--breach)', borderColor: 'var(--breach-border)', padding: '4px 8px' }} onClick={() => removeItem(idx)}>✕</button>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{items.length} items</span>
            <span className="data-num" style={{ fontSize: '0.875rem' }}>
              Est. ₹{items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <button className="btn btn-amber btn-full btn-lg" disabled={createMut.isPending || !propertyId || !vendorName || items.length === 0} onClick={submit}>
        {createMut.isPending
          ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Creating…</>
          : <><Truck size={16} /> Create Purchase Order</>}
      </button>
    </div>
  );
}

