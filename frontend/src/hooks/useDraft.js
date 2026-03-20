import { useEffect, useRef, useCallback } from 'react';

const DRAFT_KEY = 'material_draft';
const SAVE_DELAY = 1000;

export function useDraft({ editor, title, tags }) {
    const timeoutRef = useRef(null);

    const saveDraft = useCallback(() => {
        if (!editor) return;
        const draft = {
            title,
            content: editor.getHTML(),
            tags,
            savedAt: Date.now(),
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, [editor, title, tags]);

    const scheduleSave = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(saveDraft, SAVE_DELAY);
    }, [saveDraft]);

    useEffect(() => {
        if (!editor) return;
        editor.on('update', scheduleSave);
        return () => editor.off('update', scheduleSave);
    }, [editor, scheduleSave]);

    useEffect(() => {
        scheduleSave();
    }, [title, tags, scheduleSave]);

    const loadDraft = useCallback(() => {
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            if (!raw) return null;
            const draft = JSON.parse(raw);
            if (Date.now() - draft.savedAt > 7 * 24 * 60 * 60 * 1000) {
                localStorage.removeItem(DRAFT_KEY);
                return null;
            }
            return draft;
        } catch {
            return null;
        }
    }, []);

    const clearDraft = useCallback(() => {
        localStorage.removeItem(DRAFT_KEY);
    }, []);

    const hasDraft = useCallback(() => {
        return !!loadDraft();
    }, [loadDraft]);

    return { loadDraft, clearDraft, hasDraft };
}