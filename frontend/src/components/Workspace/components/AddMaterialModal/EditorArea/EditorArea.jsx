import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { editorExtensions } from './editorExtensions';
import styles from './EditorArea.module.css';

export default function EditorArea({ onEditorReady }) {
    const editor = useEditor({
        extensions: editorExtensions,
        content: '',
        editorProps: {
            attributes: {
                class: styles.proseMirror,
            },
        },
    });

    const onReadyRef = useRef(onEditorReady);
    useEffect(() => {
        onReadyRef.current = onEditorReady;
    }, [onEditorReady]);

    useEffect(() => {
        if (editor) onReadyRef.current?.(editor);
    }, [editor]);

    if (!editor) return null;

    return <EditorContent editor={editor} className={styles.container} />;
}