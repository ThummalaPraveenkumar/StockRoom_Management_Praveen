import { useToast } from '../hooks/useToast';
import { X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();
  if (!toasts.length) return null;

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className="toast" role="alert">
          <span className={`toast-dot ${t.type}`} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{t.title}</div>
            {t.message && (
              <div style={{ color: '#94A3B8', fontSize: '0.8125rem', marginTop: 2, lineHeight: 1.4 }}>
                {t.message}
              </div>
            )}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: '2px', flexShrink: 0 }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
