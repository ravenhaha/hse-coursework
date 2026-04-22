import { useState, useEffect, useRef } from 'react';

export function useWordCount(editor) {
    const [wordCount, setWordCount] = useState({ words: 0, chars: 0 });
    const rafRef = useRef(null);

    useEffect(() => {
        if (!editor) return;

        const update = () => {
            // Дебаунсим через rAF — не чаще 1 раза за кадр
            if (rafRef.current) cancelAnimationFrame(rafRef.current);

            rafRef.current = requestAnimationFrame(() => {
                const text = editor.state.doc.textContent;
                const trimmed = text.trim();
                const chars = text.length;
                const words = trimmed ? trimmed.split(/\s+/).length : 0;
                setWordCount({ words, chars });
            });
        };

        editor.on('update', update);
        update();

        return () => {
            editor.off('update', update);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [editor]);

    return wordCount;
}