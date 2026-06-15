function StatCard({ label, value }) {
  return (
    <div
      style={{
        flex: '1 1 90px',
        minWidth: 90,
        padding: 10,
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function SmallList({ title, items }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{title}</div>

      {items.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.6 }}>Нет данных</div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {items.slice(0, 5).map((item) => (
            <div
              key={`${title}-${item.id}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                fontSize: 13,
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  opacity: 0.9,
                }}
                title={item.name}
              >
                {item.name}
              </span>
              <strong>{item.count}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MaterialsSummaryPanel({
  summary,
  onExport,
  onImport,
  canImport = true,
  exporting = false,
  note = '',
}) {
  if (!summary) return null;

  return (
    <div
      style={{
        marginTop: 12,
        marginBottom: 12,
        padding: 12,
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700 }}>Статистика по текущему списку</div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={onExport} disabled={exporting}>
            {exporting ? 'Экспорт…' : 'Экспорт CSV'}
          </button>

          <button type="button" onClick={onImport} disabled={!canImport}>
            Импорт CSV
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <StatCard label="Всего" value={summary.total} />
        <StatCard label="Текстовые" value={summary.byType.text} />
        <StatCard label="Файловые" value={summary.byType.file} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}
      >
        <SmallList title="По коллекциям" items={summary.byCollection} />
        <SmallList title="По тегам" items={summary.byTag} />
      </div>

      {note ? (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
          {note}
        </div>
      ) : null}
    </div>
  );
}