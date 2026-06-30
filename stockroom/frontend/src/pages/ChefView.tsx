import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChefHat, AlertTriangle, CheckCircle, RefreshCw,
  ChevronLeft, Plus, Minus, Star, BookOpen, Search, Zap, Clock, ClipboardList
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket, joinProperty } from '../lib/socket';
import { useToast } from '../hooks/useToast';
import StockCard from '../components/StockCard';
import LedgerDrawer from '../components/LedgerDrawer';
import { SkeletonList } from '../components/Skeleton';

type Tab = 'stock' | 'recipes' | 'service' | 'request';

const TABS: { id: Tab; label: string; Icon: any }[] = [
  { id: 'stock',   label: 'Stock',    Icon: ClipboardList },
  { id: 'recipes', label: 'Recipes',  Icon: BookOpen },
  { id: 'service', label: 'Log Dish', Icon: Star },
  { id: 'request', label: 'Request',  Icon: Plus },
];

export default function ChefView() {
  const [tab, setTab] = useState<Tab>('stock');
  const [propertyId, setPropertyId] = useState('');
  const [userId, setUserId] = useState('');
  const [ledger, setLedger] = useState<any | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: properties } = useQuery({ queryKey: ['properties'], queryFn: api.getProperties });
  const { data: users }      = useQuery({ queryKey: ['users'],      queryFn: api.getUsers });

  useEffect(() => { if (properties?.length && !propertyId) setPropertyId(properties[0].id); }, [properties]);
  useEffect(() => {
    if (users && propertyId && !userId) {
      const chef = users.find((u: any) => u.role === 'chef' && u.property_id === propertyId);
      if (chef) setUserId(chef.id);
    }
  }, [users, propertyId]);

  useEffect(() => {
    if (!propertyId) return;
    joinProperty(propertyId);
    const socket = getSocket();
    const handler = ({ propertyId: pid }: any) => {
      if (pid !== propertyId) return;
      qc.invalidateQueries({ queryKey: ['stock', propertyId] });
      qc.invalidateQueries({ queryKey: ['alerts', propertyId] });
      toast('info', 'Stock updated', 'Another surface changed stock levels');
    };
    socket.on('stock_updated', handler);
    return () => { socket.off('stock_updated', handler); };
  }, [propertyId]);

  const { data: stock, isLoading } = useQuery({
    queryKey: ['stock', propertyId],
    queryFn: () => api.getStock(propertyId),
    enabled: !!propertyId,
    refetchInterval: 30_000,
  });

  const { data: alerts } = useQuery({
    queryKey: ['alerts', propertyId],
    queryFn: () => api.getAlerts(propertyId),
    enabled: !!propertyId,
  });

  const alertCount = (alerts ?? []).length;
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['stock', propertyId] });
    qc.invalidateQueries({ queryKey: ['alerts', propertyId] });
  };

  return (
    <div className="mobile-page">
      {/* Top bar */}
      <div style={{ background: '#0D9488', color: '#fff', padding: '14px 16px 0', flexShrink: 0, position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Link to="/" style={{ color: 'rgba(255,255,255,0.7)', display: 'flex', padding: 4, borderRadius: 8 }}>
            <ChevronLeft size={20} />
          </Link>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>Chef View</div>
            {properties && (
              <select style={{ background: 'transparent', color: 'rgba(255,255,255,0.75)', fontSize: '0.75rem', border: 'none', outline: 'none', marginTop: 1, cursor: 'pointer' }}
                value={propertyId} onChange={e => setPropertyId(e.target.value)}>
                {properties.map((p: any) => <option key={p.id} value={p.id} style={{ color: '#000' }}>{p.name}</option>)}
              </select>
            )}
          </div>
          {alertCount > 0 && (
            <span style={{ background: '#FCA5A5', color: '#7F1D1D', fontSize: '0.6875rem', fontWeight: 700, padding: '3px 9px', borderRadius: 999 }}>
              {alertCount} alert{alertCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 4px', background: 'transparent', border: 'none',
              borderBottom: tab === t.id ? '2px solid #fff' : '2px solid transparent',
              color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.5)',
              fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.04em',
              textTransform: 'uppercase', cursor: 'pointer', transition: 'color 0.12s',
            }}>
              <t.Icon size={15} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mobile-scroll" style={{ paddingTop: 16 }}>
        {tab === 'stock' && (
          <StockTab
            stock={stock ?? []} alerts={alerts ?? []} isLoading={isLoading}
            onOpenLedger={setLedger}
          />
        )}
        {tab === 'recipes' && propertyId && (
          <RecipesTab propertyId={propertyId} stock={stock ?? []} />
        )}
        {tab === 'service' && propertyId && userId && (
          <LogServiceTab propertyId={propertyId} userId={userId}
            onSuccess={() => { invalidate(); toast('success', 'Dish logged', 'Recipe ingredients deducted'); }} />
        )}
        {tab === 'request' && propertyId && userId && (
          <RaiseRequestTab propertyId={propertyId} userId={userId} ingredients={stock ?? []}
            onSuccess={() => toast('success', 'Request raised', 'Sent to F&B manager for approval')} />
        )}
      </div>

      {/* Bottom nav */}
      <div className="bottom-nav">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`bottom-nav-item ${tab === t.id ? 'active-chef' : ''}`}>
            <t.Icon size={18} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Ledger drawer */}
      {ledger && propertyId && (
        <LedgerDrawer
          propertyId={propertyId}
          ingredientId={ledger.ingredientId}
          ingredientName={ledger.name}
          baseUnit={ledger.baseUnit}
          displayQuantity={ledger.displayQuantity}
          status={ledger.status}
          onClose={() => setLedger(null)}
        />
      )}
    </div>
  );
}

/* ─── Stock Tab ─────────────────────────────────────────────────────── */
function StockTab({ stock, alerts, isLoading, onOpenLedger }: any) {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('All');
  const categories = ['All', ...new Set((stock as any[]).map((s: any) => s.category))];

  const critical = (alerts as any[]).filter((a: any) => a.alertType !== 'low_stock');
  const filtered = stock.filter((s: any) =>
    (cat === 'All' || s.category === cat) &&
    (!search || s.name.toLowerCase().includes(search.toLowerCase()))
  );

  if (isLoading) return <SkeletonList />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Critical alerts */}
      {critical.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {critical.slice(0, 2).map((a: any) => (
            <div key={a.id} className="alert-banner critical">
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input className="input" placeholder="Search ingredients…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 38 }} />
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {(categories as string[]).map(c => (
          <button key={c} onClick={() => setCat(c)} className={`tag-pill ${cat === c ? 'active' : ''}`}
            style={cat === c ? { background: '#0D9488', color: '#fff', borderColor: '#0D9488' } : {}}>
            {c}
          </button>
        ))}
      </div>

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { label: 'OK',       count: stock.filter((s: any) => s.status === 'ok').length,       color: 'var(--ok)' },
          { label: 'Low',      count: stock.filter((s: any) => s.status === 'low').length,      color: 'var(--low)' },
          { label: 'Critical', count: stock.filter((s: any) => s.status === 'critical').length, color: 'var(--critical)' },
          { label: 'Out',      count: stock.filter((s: any) => s.status === 'breach').length,   color: 'var(--breach)' },
        ].map(s => s.count > 0 && (
          <div key={s.label} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
            <div className="data-num" style={{ fontSize: '1.25rem', color: s.color }}>{s.count}</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Stock cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((item: any) => (
          <StockCard key={item.ingredientId} item={item} showDays onClick={() => onOpenLedger(item)} />
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><Search size={20} /></div>
            <p style={{ fontWeight: 600 }}>No ingredients found</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Recipes Tab ───────────────────────────────────────────────────── */
function RecipesTab({ propertyId, stock }: any) {
  const [selected, setSelected] = useState<string | null>(null);
  const [portions, setPortions] = useState(10);
  const { data: recipes } = useQuery({ queryKey: ['recipes', propertyId], queryFn: () => api.getRecipes(propertyId) });
  const { data: detail }  = useQuery({ queryKey: ['recipe', propertyId, selected], queryFn: () => api.getRecipe(propertyId, selected!), enabled: !!selected });

  const stockMap = new Map((stock as any[]).map((s: any) => [s.ingredientId, s]));

  if (selected && detail) {
    const maxPortions = detail.ingredients?.length
      ? Math.min(...detail.ingredients.map((ri: any) => {
          const s = stockMap.get(ri.ingredientId);
          return s ? Math.floor(s.quantityBaseUnits / ri.quantity_base_units) : 0;
        }))
      : 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button onClick={() => setSelected(null)} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#0D9488', fontWeight: 600, fontSize: '0.875rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <ChevronLeft size={16} /> All recipes
        </button>

        <div>
          <h2 style={{ fontWeight: 800, fontSize: '1.25rem' }}>{detail.name}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 2 }}>{detail.category}</p>
        </div>

        {/* Portion feasibility */}
        <div className="card" style={{ background: maxPortions > 0 ? 'var(--ok-bg)' : 'var(--breach-bg)', borderColor: maxPortions > 0 ? 'var(--ok-border)' : 'var(--breach-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Can make right now</div>
              <div className="data-num" style={{ fontSize: '2rem', color: maxPortions > 0 ? 'var(--ok)' : 'var(--breach)' }}>{maxPortions}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>portions</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Plan for</div>
              <div className="qty-stepper">
                <button className="qty-stepper-btn" onClick={() => setPortions(p => Math.max(1, p - 1))}>−</button>
                <input className="qty-stepper-input" type="number" value={portions} onChange={e => setPortions(parseInt(e.target.value) || 1)} />
                <button className="qty-stepper-btn" onClick={() => setPortions(p => p + 1)}>+</button>
              </div>
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <p className="section-label">Ingredients per portion</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(detail.ingredients ?? []).map((ri: any) => {
            const s = stockMap.get(ri.ingredientId);
            const available = s ? Math.floor(s.quantityBaseUnits / ri.quantity_base_units) : 0;
            const sufficient = available >= portions;
            const needed = ri.quantity_base_units * portions;
            return (
              <div key={ri.id} className="card-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: !sufficient ? 'var(--breach-border)' : undefined, background: !sufficient ? 'var(--breach-bg)' : undefined }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{ri.name}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{fmtBase(ri.quantity_base_units, ri.base_unit)}/portion · need {fmtBase(needed, ri.base_unit)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="data-num" style={{ color: sufficient ? 'var(--ok)' : 'var(--breach)', fontSize: '0.9375rem' }}>
                    {available} portions
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s?.displayQuantity ?? '—'} in stock</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ fontWeight: 800, fontSize: '1.25rem' }}>Recipes</h2>
      {!(recipes?.length) && <SkeletonList count={3} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(recipes ?? []).map((r: any) => (
          <button key={r.id} onClick={() => setSelected(r.id)}
            className="card" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--border)', transition: 'border-color 0.12s' }}>
            <div style={{ width: 40, height: 40, background: '#F0FDFA', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BookOpen size={18} style={{ color: '#0D9488' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{r.name}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{r.category} · {r.ingredientCount} ingredients</div>
            </div>
            <ChevronLeft size={16} style={{ color: 'var(--text-muted)', transform: 'rotate(180deg)' }} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Log Service ───────────────────────────────────────────────────── */
function LogServiceTab({ propertyId, userId, onSuccess }: any) {
  const [menuItemId, setMenuItemId] = useState('');
  const [qty, setQty] = useState(1);
  const [posMode, setPosMode] = useState(false);
  const [error, setError] = useState('');
  const { data: menuItems } = useQuery({ queryKey: ['menu-items', propertyId], queryFn: () => api.getMenuItems(propertyId) });

  const logMut  = useMutation({ mutationFn: (d: object) => api.logService(d), onSuccess, onError: (e: any) => setError(e.message) });
  const posMut  = useMutation({ mutationFn: (d: object) => api.posEvent(d),   onSuccess, onError: (e: any) => setError(e.message) });
  const pending = logMut.isPending || posMut.isPending;

  const submit = () => {
    setError('');
    if (!menuItemId) { setError('Select a dish first'); return; }
    if (posMode) posMut.mutate({ propertyId, menuItemId, quantityPrepared: qty, posOrderId: `POS-${Date.now()}` });
    else         logMut.mutate({ propertyId, menuItemId, quantityPrepared: qty, loggedBy: userId });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontWeight: 800, fontSize: '1.25rem' }}>Log Dish Prepared</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 3 }}>Auto-deducts all recipe ingredients from stock.</p>
      </div>

      {error && <div className="alert-banner danger"><AlertTriangle size={14} style={{ flexShrink: 0 }} /><span>{error}</span></div>}

      {/* POS toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 12 }}>
        <div style={{ width: 32, height: 32, background: '#6D28D9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Zap size={15} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#4C1D95' }}>Mock POS Event</div>
          <div style={{ fontSize: '0.75rem', color: '#6D28D9' }}>Simulate auto-trigger from POS system</div>
        </div>
        <button onClick={() => setPosMode(!posMode)} style={{
          width: 44, height: 24, borderRadius: 999, background: posMode ? '#6D28D9' : '#CBD5E1',
          border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}>
          <div style={{
            width: 18, height: 18, background: '#fff', borderRadius: '50%',
            position: 'absolute', top: 3, left: posMode ? 23 : 3, transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="field-label">Dish</label>
          <select className="input" value={menuItemId} onChange={e => setMenuItemId(e.target.value)}>
            <option value="">Select dish…</option>
            {(menuItems ?? []).map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Portions prepared</label>
          <div className="qty-stepper" style={{ width: 160 }}>
            <button className="qty-stepper-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
            <input className="qty-stepper-input" type="number" min="1" value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} />
            <button className="qty-stepper-btn" onClick={() => setQty(q => q + 1)}>+</button>
          </div>
        </div>
      </div>

      <button className={`btn btn-full btn-lg ${posMode ? 'btn-violet' : 'btn-teal'}`} disabled={pending || !menuItemId} onClick={submit}>
        {pending ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processing…</> : posMode ? <><Zap size={16} /> Fire POS Event</> : <><Star size={16} /> Log Prepared</>}
      </button>
    </div>
  );
}

/* ─── Raise Request ─────────────────────────────────────────────────── */
function RaiseRequestTab({ propertyId, userId, ingredients }: any) {
  const [ingredientId, setIngredientId] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('kg');
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const { data: myRequests } = useQuery({ queryKey: ['my-requests', propertyId], queryFn: () => api.getPurchaseRequests({ propertyId }) });

  const mutation = useMutation({
    mutationFn: (d: object) => api.createPurchaseRequest(d),
    onSuccess: () => { setSuccess(true); setIngredientId(''); setQty(''); setNotes(''); setTimeout(() => setSuccess(false), 4000); },
    onError: (e: any) => setError(e.message),
  });

  const lowItems = (ingredients as any[]).filter((i: any) => ['low','critical','breach'].includes(i.status));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontWeight: 800, fontSize: '1.25rem' }}>Raise Purchase Request</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 3 }}>Goes to F&amp;B manager → purchase manager.</p>
      </div>

      {success && <div className="alert-banner success"><CheckCircle size={14} style={{ flexShrink: 0 }} /> Request raised. Awaiting Arjun's approval.</div>}
      {error   && <div className="alert-banner danger"><AlertTriangle size={14} style={{ flexShrink: 0 }} /><span>{error}</span></div>}

      {lowItems.length > 0 && (
        <div>
          <p className="section-label">Needs reorder now</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {lowItems.map((i: any) => (
              <button key={i.ingredientId} onClick={() => setIngredientId(i.ingredientId)}
                className={`tag-pill ${ingredientId === i.ingredientId ? 'active' : ''}`}
                style={ingredientId === i.ingredientId ? { background: '#0D9488', color: '#fff', borderColor: '#0D9488' }
                  : { borderColor: i.status === 'breach' ? 'var(--breach)' : i.status === 'critical' ? 'var(--critical)' : 'var(--low)',
                      color: i.status === 'breach' ? 'var(--breach)' : i.status === 'critical' ? 'var(--critical)' : 'var(--low)' }}>
                {i.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="field-label">Ingredient</label>
          <select className="input" value={ingredientId} onChange={e => setIngredientId(e.target.value)}>
            <option value="">Select ingredient…</option>
            {(ingredients as any[]).map((i: any) => (
              <option key={i.ingredientId} value={i.ingredientId}>{i.name} — {i.displayQuantity}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="field-label">Quantity needed</label>
            <input className="input" type="number" min="0" step="0.1" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Unit</label>
            <select className="input" value={unit} onChange={e => setUnit(e.target.value)}>
              <option value="kg">kg</option><option value="g">g</option>
              <option value="litre">litre</option><option value="piece">piece</option><option value="case">case</option>
            </select>
          </div>
        </div>
        <div>
          <label className="field-label">Notes for manager</label>
          <textarea className="input" placeholder="Why urgently needed?" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      <button className="btn btn-teal btn-full btn-lg" disabled={mutation.isPending || !ingredientId || !qty}
        onClick={() => { setError(''); mutation.mutate({ propertyId, ingredientId, quantity: parseFloat(qty), unit, notes, raisedBy: userId }); }}>
        {mutation.isPending ? <><RefreshCw size={16} /> Raising…</> : <><Plus size={16} /> Raise Request</>}
      </button>

      {/* My recent requests */}
      {(myRequests?.length ?? 0) > 0 && (
        <div>
          <p className="section-label" style={{ marginTop: 8 }}>My recent requests</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(myRequests ?? []).slice(0, 5).map((r: any) => (
              <div key={r.id} className="card-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.ingredientName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <span className={`badge badge-${r.status === 'approved' || r.status === 'ordered' ? 'ok' : r.status === 'rejected' ? 'breach' : r.status === 'pending' ? 'low' : 'gray'}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function fmtBase(qty: number, unit: string) {
  const a = Math.abs(qty);
  if (unit === 'g')  return a >= 1000 ? `${(a/1000).toFixed(2)} kg` : `${a.toFixed(0)} g`;
  if (unit === 'ml') return a >= 1000 ? `${(a/1000).toFixed(2)} L`  : `${a.toFixed(0)} ml`;
  return `${a} ${unit}`;
}
