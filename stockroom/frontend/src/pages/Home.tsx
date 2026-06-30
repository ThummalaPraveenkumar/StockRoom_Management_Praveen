import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package, ChefHat, BarChart3, ShoppingCart, ArrowRight, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

const surfaces = [
  {
    to: '/store',
    Icon: Package,
    role: 'Store Keeper',
    name: 'Store App',
    description: 'Receive deliveries, issue to kitchen, record wastage and physical counts',
    accentBg: '#1D4ED8',
    accentLight: '#EFF6FF',
    accentText: '#1D4ED8',
    user: 'Kavitha',
    tag: 'Mobile / Tablet',
  },
  {
    to: '/chef',
    Icon: ChefHat,
    role: 'Head Chef',
    name: 'Chef View',
    description: 'Check live stock levels, log dishes prepared, raise purchase requests',
    accentBg: '#0D9488',
    accentLight: '#F0FDFA',
    accentText: '#0D9488',
    user: 'Ramesh',
    tag: 'Mobile',
  },
  {
    to: '/manager',
    Icon: BarChart3,
    role: 'F&B Manager',
    name: 'Manager Dashboard',
    description: 'Food cost tracking, approve requests, month-end reconciliation',
    accentBg: '#6D28D9',
    accentLight: '#F5F3FF',
    accentText: '#6D28D9',
    user: 'Arjun',
    tag: 'Web',
  },
  {
    to: '/purchase',
    Icon: ShoppingCart,
    role: 'Purchase Manager',
    name: 'Purchase Console',
    description: 'Chain-wide stock view, consolidated vendor orders across properties',
    accentBg: '#B45309',
    accentLight: '#FFFBEB',
    accentText: '#B45309',
    user: 'Meena',
    tag: 'Web',
  },
];

export default function Home() {
  const { data: properties } = useQuery({ queryKey: ['properties'], queryFn: api.getProperties });

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0F172A',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 820 }}>

        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '8px 16px', marginBottom: 20,
          }}>
            <Package size={18} style={{ color: '#60A5FA' }} />
            <span style={{ color: '#E2E8F0', fontWeight: 700, fontSize: '0.875rem', letterSpacing: '0.04em' }}>
              STOCKROOM
            </span>
          </div>
          <h1 style={{
            color: '#F8FAFC', fontWeight: 800, fontSize: 'clamp(1.75rem, 5vw, 2.5rem)',
            lineHeight: 1.15, marginBottom: 12, textWrap: 'balance',
          }}>
            Hotel Raw Material Management
          </h1>
          <p style={{ color: '#64748B', fontSize: '1rem', maxWidth: 460, margin: '0 auto' }}>
            One live ledger. Four role-specific surfaces. Stock that stays correct as it moves.
          </p>
          {properties && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              {properties.map((p: any) => (
                <span key={p.id} style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 999, padding: '4px 12px', fontSize: '0.8125rem', color: '#94A3B8',
                }}>
                  {p.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Surface cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
          {surfaces.map(s => (
            <Link key={s.to} to={s.to} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 18,
                padding: '20px 22px',
                transition: 'all 0.15s ease',
                display: 'flex', flexDirection: 'column', gap: 14,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.07)';
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.15)';
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)';
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: s.accentBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <s.Icon size={20} color="white" />
                  </div>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.05em',
                    textTransform: 'uppercase', color: '#475569',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6, padding: '3px 8px',
                  }}>{s.tag}</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: s.accentBg, marginBottom: 4, letterSpacing: '0.02em' }}>
                    {s.role} · {s.user}
                  </div>
                  <h2 style={{ color: '#F1F5F9', fontWeight: 700, fontSize: '1.125rem', marginBottom: 6 }}>
                    {s.name}
                  </h2>
                  <p style={{ color: '#64748B', fontSize: '0.875rem', lineHeight: 1.5 }}>
                    {s.description}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: s.accentBg, fontSize: '0.875rem', fontWeight: 600 }}>
                  Open surface <ArrowRight size={14} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p style={{ textAlign: 'center', color: '#334155', fontSize: '0.8125rem', marginTop: 32 }}>
          Demo mode · Seed data loaded · All surfaces share live stock data
        </p>
      </div>
    </div>
  );
}
