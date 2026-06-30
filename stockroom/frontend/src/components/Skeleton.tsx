export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="skeleton" style={{ height: 18, width: '60%' }} />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 14, width: i === lines - 1 ? '40%' : '80%' }} />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={i % 2 === 0 ? 2 : 3} />
      ))}
    </div>
  );
}
