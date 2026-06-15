import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  IoCalendarOutline,
  IoFolderOpenOutline,
  IoStar,
  IoStarOutline,
  IoCloseOutline,
  IoDocumentTextOutline,
  IoImageOutline,
  IoAttachOutline,
} from 'react-icons/io5';
import { BsFiletypePdf, BsFiletypeDocx } from 'react-icons/bs';
import styles from './FilterBar.module.css';

// ── ИКОНКИ ТИПОВ ──
const KIND_OPTIONS = [
  { value: 'text',  label: 'Заметки',  Icon: IoDocumentTextOutline, color: '#3AD7D3' },
  { value: 'pdf',   label: 'PDF',      Icon: BsFiletypePdf,         color: '#ff6b6b' },
  { value: 'docx',  label: 'Word',     Icon: BsFiletypeDocx,        color: '#6bb6d6' },
  { value: 'image', label: 'Картинки', Icon: IoImageOutline,        color: '#b890ff' },
  { value: 'file',  label: 'Файлы',    Icon: IoAttachOutline,       color: '#89aab7' },
];

const PRESETS = [
  { key: 'today',     label: 'Сегодня' },
  { key: 'yesterday', label: 'Вчера' },
  { key: 'week',      label: '7 дней' },
  { key: 'month',     label: '30 дней' },
  { key: '3months',   label: '3 мес' },
  { key: 'year',      label: 'Год' },
];

const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const fromPreset = (key) => {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from = new Date(to);
  switch (key) {
    case 'today': break;
    case 'yesterday': from.setDate(from.getDate() - 1); to.setDate(to.getDate() - 1); break;
    case 'week':    from.setDate(from.getDate() - 6); break;
    case 'month':   from.setDate(from.getDate() - 29); break;
    case '3months': from.setMonth(from.getMonth() - 3); break;
    case 'year':    from.setFullYear(from.getFullYear() - 1); break;
    default: return { from: null, to: null };
  }
  return { from: toISO(from), to: toISO(to) };
};

const normalize = (filters) => ({
  dateFrom: filters.dateFrom ?? null,
  dateTo:   filters.dateTo ?? null,
  kind:     filters.kind ?? null,
  onlyImportant: !!filters.onlyImportant,
});

// 🆕 ЭТАП 2: красивое форматирование даты для тултипа
const formatDateRu = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

export default function FiltersBar({ filters, onChange }) {
  const f = useMemo(() => normalize(filters), [filters]);
  const [openMenu, setOpenMenu] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpenMenu(null);
    };
    if (openMenu) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [openMenu]);

  const update = useCallback(
    (patch) => onChange({ ...filters, ...patch }),
    [filters, onChange]
  );

  const activeCount =
    (f.dateFrom || f.dateTo ? 1 : 0) +
    (f.kind ? 1 : 0) +
    (f.onlyImportant ? 1 : 0);

  const resetAll = () => {
    update({ dateFrom: null, dateTo: null, period: 'all', kind: null, onlyImportant: false });
    setOpenMenu(null);
  };

  const applyPreset = (key) => {
    const { from, to } = fromPreset(key);
    update({ dateFrom: from, dateTo: to, period: key });
  };

  const activePreset = useMemo(() => {
    if (!f.dateFrom || !f.dateTo) return null;
    return PRESETS.find((p) => {
      const r = fromPreset(p.key);
      return r.from === f.dateFrom && r.to === f.dateTo;
    })?.key ?? null;
  }, [f.dateFrom, f.dateTo]);

  const activeKind = KIND_OPTIONS.find((k) => k.value === f.kind);
  const ActiveKindIcon = activeKind?.Icon;

  // 🆕 ЭТАП 2: динамические тултипы
  const dateTooltip = (() => {
    if (!f.dateFrom && !f.dateTo) return 'Фильтр по периоду';
    if (activePreset) {
      const preset = PRESETS.find((p) => p.key === activePreset);
      return `Период: ${preset?.label ?? ''}`;
    }
    if (f.dateFrom && f.dateTo) return `Период: ${formatDateRu(f.dateFrom)} — ${formatDateRu(f.dateTo)}`;
    if (f.dateFrom) return `Период: с ${formatDateRu(f.dateFrom)}`;
    return `Период: до ${formatDateRu(f.dateTo)}`;
  })();

  const kindTooltip = f.kind
    ? `Тип: ${activeKind.label} (кликните, чтобы сменить)`
    : 'Фильтр по типу материала';

  const importantTooltip = f.onlyImportant
    ? 'Показаны только важные — кликните, чтобы убрать фильтр'
    : 'Показать только важные материалы';

  const resetTooltip = `Сбросить все фильтры (${activeCount})`;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.bar}>
        <span className={styles.label}>Фильтры</span>

        {/* 📅 ДАТА */}
        <button
          type="button"
          className={`${styles.iconBtn} ${(f.dateFrom || f.dateTo) ? styles.iconBtnActive : ''}`}
          onClick={() => setOpenMenu(openMenu === 'date' ? null : 'date')}
          title={dateTooltip}
          aria-label={dateTooltip}
        >
          <IoCalendarOutline size={15} />
          {(f.dateFrom || f.dateTo) && <span className={styles.dot} />}
        </button>

        {/* 📁 ТИП */}
        <button
          type="button"
          className={`${styles.iconBtn} ${f.kind ? styles.iconBtnActive : ''}`}
          onClick={() => setOpenMenu(openMenu === 'kind' ? null : 'kind')}
          title={kindTooltip}
          aria-label={kindTooltip}
          style={f.kind ? { color: activeKind.color, borderColor: `${activeKind.color}55` } : undefined}
        >
          {ActiveKindIcon ? <ActiveKindIcon size={15} /> : <IoFolderOpenOutline size={15} />}
          {f.kind && <span className={styles.dot} style={{ background: activeKind.color }} />}
        </button>

        {/* ⭐ ВАЖНЫЕ */}
        <button
          type="button"
          className={`${styles.iconBtn} ${f.onlyImportant ? styles.iconBtnImportant : ''}`}
          onClick={() => update({ onlyImportant: !f.onlyImportant })}
          title={importantTooltip}
          aria-label={importantTooltip}
        >
          {f.onlyImportant
            ? <IoStar size={15} color="#f5a623" />
            : <IoStarOutline size={15} />
          }
        </button>

        {activeCount > 0 && (
          <button
            type="button"
            className={styles.resetInline}
            onClick={resetAll}
            title={resetTooltip}
            aria-label={resetTooltip}
          >
            <IoCloseOutline size={14} />
            <span>{activeCount}</span>
          </button>
        )}
      </div>

      {/* ═══ POPUP: ДАТА ═══ */}
      {openMenu === 'date' && (
        <div className={styles.popup}>
          <div className={styles.popupTitle}>
            <IoCalendarOutline size={12} />
            Период
          </div>

          <div className={styles.presets}>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`${styles.preset} ${activePreset === p.key ? styles.presetActive : ''}`}
                onClick={() => applyPreset(p.key)}
                title={`Применить период: ${p.label}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className={styles.divider} />

          <label className={styles.dateField}>
            <span>От</span>
            <input
              type="date"
              value={f.dateFrom ?? ''}
              max={f.dateTo ?? undefined}
              onChange={(e) => update({ dateFrom: e.target.value || null, period: 'custom' })}
              title="Дата начала периода"
            />
          </label>
          <label className={styles.dateField}>
            <span>До</span>
            <input
              type="date"
              value={f.dateTo ?? ''}
              min={f.dateFrom ?? undefined}
              onChange={(e) => update({ dateTo: e.target.value || null, period: 'custom' })}
              title="Дата окончания периода"
            />
          </label>

          {(f.dateFrom || f.dateTo) && (
            <>
              <div className={styles.divider} />
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => update({ dateFrom: null, dateTo: null, period: 'all' })}
                title="Очистить фильтр по дате"
              >
                Очистить
              </button>
            </>
          )}
        </div>
      )}

      {/* ═══ POPUP: ТИП ═══ */}
      {openMenu === 'kind' && (
        <div className={styles.popup}>
          <div className={styles.popupTitle}>
            <IoFolderOpenOutline size={12} />
            Тип материала
          </div>

          <div className={styles.kindList}>
            {KIND_OPTIONS.map((k) => {
              const Icon = k.Icon;
              const isActive = f.kind === k.value;
              return (
                <button
                  key={k.value}
                  type="button"
                  className={`${styles.kindRow} ${isActive ? styles.kindRowActive : ''}`}
                  onClick={() => update({ kind: isActive ? null : k.value })}
                  title={isActive ? `Убрать фильтр «${k.label}»` : `Показать только «${k.label}»`}
                >
                  <Icon size={16} color={k.color} />
                  <span>{k.label}</span>
                  {isActive && <span className={styles.check}>✓</span>}
                </button>
              );
            })}
          </div>

          {f.kind && (
            <>
              <div className={styles.divider} />
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => update({ kind: null })}
                title="Очистить фильтр по типу"
              >
                Очистить
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}