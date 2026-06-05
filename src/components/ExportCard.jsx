
export function ExportCard({ label, description, onExport, actions = null }) {
  return (
    <div
      className="w-full p-6 rounded-2xl text-left shadow-lg"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <p className="font-black uppercase tracking-widest text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{label}</p>
      <p className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>{description}</p>
      {actions ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map(action => (
            <button
              key={action.label}
              onClick={action.onClick}
              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
              style={{
                backgroundColor: action.variant === 'secondary' ? 'var(--bg-raised)' : 'var(--accent)',
                color: action.variant === 'secondary' ? 'var(--text-on-raised)' : '#fff',
                border: action.variant === 'secondary' ? '1px solid var(--border)' : '1px solid transparent',
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={onExport}
          className="mt-4 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--accent)', color: '#fff', border: '1px solid transparent' }}
        >
          Export
        </button>
      )}
    </div>
  );
}
