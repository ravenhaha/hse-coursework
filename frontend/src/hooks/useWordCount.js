import { useState, useEffect } from 'react';

export function useWordCount(editor) {
    const [wordCount, setWordCount] = useState({ words: 0, chars: 0 });

    useEffect(() => {
        if (!editor) return;

        const update = () => {
            const text = editor.state.doc.textContent;
            const chars = text.length;
            const words = text.trim() ? text.trim().split(/\s+/).length : 0;
            setWordCount({ words, chars });
        };

        editor.on('update', update);
        update();
        return () => editor.off('update', update);
    }, [editor]);

    return wordCount;
}