import { useState, useRef, useEffect } from 'react';
import { FONTS } from './fonts';
import { loadFont } from './fontLoader';
import styles from './FontSelect.module.css';

export function FontSelect({ editor }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const currentFont = editor.getAttributes('textStyle').fontFamily || '';

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectFont = async (font) => {
    if (font.type === 'google') {
      setLoading(true);
      await loadFont(font.family);
      setLoading(false);
    }

    editor.chain().focus().setFontFamily(font.family).run();
    setOpen(false);
    setSearch('');
  };

  const filtered = FONTS.filter(f =>
    f.label.toLowerCase().includes(search.toLowerCase())
  );

  const currentLabel = FONTS.find(f => f.family === currentFont)?.label || 'Шрифт';

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={styles.trigger}
        onClick={() => setOpen(!open)}
        title="Выбрать шрифт"
      >
        <span className={styles.label}>
          {loading ? '⏳ Загрузка...' : currentLabel}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className={styles.dropdown}>
          <input
            className={styles.search}
            placeholder="Поиск шрифта..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className={styles.list}>
            {filtered.map(font => (
              <button
                key={font.family}
                className={`${styles.option} ${
                  currentFont === font.family ? styles.selected : ''
                }`}
                onClick={() => selectFont(font)}
              >
                <span>{font.label}</span>
                {font.type === 'system' && (
                  <span className={styles.badge}>системный</span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className={styles.empty}>Ничего не найдено</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}