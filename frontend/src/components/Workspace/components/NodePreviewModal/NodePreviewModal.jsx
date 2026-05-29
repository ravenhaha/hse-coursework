import { useEffect, useCallback, useState } from 'react';
import { IoDocumentTextOutline, IoPricetagOutline } from 'react-icons/io5';
import { materialsApi } from '../../../../api/materials';
import styles from './NodePreviewModal.module.css';

const SNIPPET_MAX_CHARS = 600;

// 🆕 Граф присылает id в формате "material:9". Достаём integer.
function parseMaterialId(rawId) {
    if (rawId == null) return null;
    if (typeof rawId === 'number') return rawId;
    const s = String(rawId);
    const m = s.match(/(\d+)$/);
    return m ? Number(m[1]) : null;
}

export default function NodePreviewModal({ node, onClose, onOpenFull }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [full, setFull] = useState(null);

    const handleKeyDown = useCallback(
        (e) => { if (e.key === 'Escape') onClose(); },
        [onClose]
    );

    useEffect(() => {
        if (!node) return;
        document.body.classList.add('no-scroll');
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.classList.remove('no-scroll');
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [node, handleKeyDown]);

    useEffect(() => {
        if (!node?.id) return;
        const numId = parseMaterialId(node.id);
        if (numId == null) {
            setError('Некорректный id материала');
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);
        setFull(null);

        materialsApi
            .get(numId)
            .then((data) => {
                if (cancelled) return;
                setFull(data);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('[NodePreviewModal] ошибка загрузки:', err);
                setError(err?.message || 'Не удалось загрузить превью');
            })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [node?.id]);

    if (!node) return null;

    const name = full?.material_name ?? full?.name ?? node.name ?? 'Материал';

    // Бэк может вернуть контент в разных полях.
    const rawContent =
        full?.text_content ??
        full?.content_html ??
        full?.content ??
        full?.body ??
        '';

    // Теги: [{id, tag_name}] / [{id, name}] / string[]
    const tagsList = (full?.tags ?? node.tags ?? [])
        .map((t) => {
            if (typeof t === 'string') return t;
            return t?.tag_name ?? t?.name ?? null;
        })
        .filter(Boolean);

    const isFile = full?.source_type === 'file';
    const snippetHtml = buildHtmlSnippet(rawContent, SNIPPET_MAX_CHARS);
    const hasContent = snippetHtml.trim().length > 0;

    return (
        <div
            className={styles.overlay}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={name}
        >
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.titleRow}>
                        <IoDocumentTextOutline className={styles.titleIcon} />
                        <h2 className={styles.title}>{name}</h2>
                    </div>
                    <button
                        type="button"
                        className={styles.close}
                        onClick={onClose}
                        aria-label="Закрыть"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {tagsList.length > 0 && (
                    <div className={styles.tags}>
                        {tagsList.map((tag, idx) => (
                            <span className={styles.tag} key={`${tag}-${idx}`}>
                                <IoPricetagOutline />
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                <div className={styles.body}>
                    {loading && (
                        <p className={styles.empty}>Загружаем превью…</p>
                    )}

                    {!loading && error && (
                        <p className={styles.empty}>⚠️ {error}</p>
                    )}

                    {!loading && !error && isFile && (
                        <p className={styles.empty}>
                            📎 Это файл
                            {full?.file_path
                                ? ` (${full.file_path.split('/').pop()})`
                                : ''}
                            . Откройте полностью для просмотра.
                        </p>
                    )}

                    {!loading && !error && !isFile && hasContent && (
                        <div
                            className={styles.snippet}
                            dangerouslySetInnerHTML={{ __html: snippetHtml }}
                        />
                    )}

                    {!loading && !error && !isFile && !hasContent && (
                        <p className={styles.empty}>
                            Пока пусто. Откройте материал, чтобы добавить содержимое.
                        </p>
                    )}
                </div>

                <div className={styles.footer}>
                    <button
                        type="button"
                        className={styles.secondary}
                        onClick={onClose}
                    >
                        Закрыть
                    </button>
                    {onOpenFull && (
                        <button
                            type="button"
                            className={styles.primary}
                            onClick={() => onOpenFull(node)}
                        >
                            Открыть полностью
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─────────── helpers ───────────

function buildHtmlSnippet(html, maxChars) {
    if (!html) return '';
    const text = stripHtml(html);
    if (text.length <= maxChars) return html;

    let visible = 0;
    let cut = html.length;
    const openTags = [];

    for (let i = 0; i < html.length; i++) {
        if (html[i] === '<') {
            const end = html.indexOf('>', i);
            if (end === -1) break;
            const tagBody = html.slice(i + 1, end).trim();

            if (!tagBody.startsWith('/') && !tagBody.endsWith('/')) {
                const name = tagBody.split(/\s/)[0].toLowerCase();
                if (!VOID_TAGS.has(name)) openTags.push(name);
            } else if (tagBody.startsWith('/')) {
                const name = tagBody.slice(1).toLowerCase();
                const idx = openTags.lastIndexOf(name);
                if (idx !== -1) openTags.splice(idx, 1);
            }

            i = end;
            continue;
        }
        visible++;
        if (visible >= maxChars) {
            cut = i + 1;
            break;
        }
    }

    let snippet = html.slice(0, cut) + '…';
    for (let i = openTags.length - 1; i >= 0; i--) {
        snippet += `</${openTags[i]}>`;
    }
    return snippet;
}

const VOID_TAGS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

function stripHtml(html) {
    return html.replace(/<[^>]*>/g, '');
}