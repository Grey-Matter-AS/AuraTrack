
export function ExportCard({ label, description, icon = null, onExport, actions = null }) {
  return (
    <div
      className="w-full p-6 rounded-2xl text-left shadow-lg"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--accent)', border: '1px solid var(--border)' }}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-black uppercase tracking-widest text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{label}</p>
          <p className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>{description}</p>
        </div>
      </div>
      {actions ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map(action => (
            <button
              key={action.label}
              onClick={action.onClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
              style={{
                backgroundColor: action.variant === 'secondary' ? 'var(--bg-raised)' : 'var(--action-blue)',
                color: '#fff',
                border: action.variant === 'secondary' ? '1px solid var(--border)' : '1px solid var(--action-blue-border)',
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={onExport}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
        >
          Export
        </button>
      )}
    </div>
  );
}
