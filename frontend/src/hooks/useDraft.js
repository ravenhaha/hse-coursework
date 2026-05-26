import { useEffect, useRef, useCallback } from 'react';

const DRAFT_KEY = 'material_draft';
const SAVE_DELAY = 1000;
const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;

function hasMeaningfulContent(editor, title, tags) {
    if (title.trim() || tags.length > 0) return true;
    if (!editor) return false;

    const html = editor.getHTML();
    return html !== '<p></p>' && html.trim() !== '';
}

export function useDraft({ editor, title, tags, isEnabled = true }) {
    const timeoutRef = useRef(null);
    const wasEnabledRef = useRef(false);

    const clearPendingSave = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const saveDraft = useCallback(() => {
        if (!editor || !isEnabled) return;

        if (!hasMeaningfulContent(editor, title, tags)) {
            localStorage.removeItem(DRAFT_KEY);
            return;
        }

        const draft = {
            title,
            content: editor.getHTML(),
            tags,
            savedAt: Date.now(),
        };

        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch {
            // Storage can fail in private mode or when quota is exceeded.
        }
    }, [editor, isEnabled, tags, title]);

    const scheduleSave = useCallback(() => {
        if (!isEnabled) {
            clearPendingSave();
            return;
        }

        clearPendingSave();
        timeoutRef.current = setTimeout(saveDraft, SAVE_DELAY);
    }, [clearPendingSave, isEnabled, saveDraft]);

    useEffect(() => {
        if (!editor || !isEnabled) return undefined;
        editor.on('update', scheduleSave);
        return () => editor.off('update', scheduleSave);
    }, [editor, isEnabled, scheduleSave]);

    useEffect(() => {
        if (!isEnabled) {
            wasEnabledRef.current = false;
            clearPendingSave();
            return;
        }

        if (!wasEnabledRef.current) {
            wasEnabledRef.current = true;
            return;
        }

        scheduleSave();
    }, [clearPendingSave, isEnabled, scheduleSave, title, tags]);

    useEffect(() => clearPendingSave, [clearPendingSave]);

    const loadDraft = useCallback(() => {
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            if (!raw) return null;

            const draft = JSON.parse(raw);
            if (Date.now() - draft.savedAt > DRAFT_TTL) {
                localStorage.removeItem(DRAFT_KEY);
                return null;
            }

            return draft;
        } catch {
            return null;
        }
    }, []);

    const clearDraft = useCallback(() => {
        clearPendingSave();
        localStorage.removeItem(DRAFT_KEY);
    }, [clearPendingSave]);

    const hasDraft = useCallback(() => {
        return !!loadDraft();
    }, [loadDraft]);

    return { loadDraft, clearDraft, hasDraft };
}
