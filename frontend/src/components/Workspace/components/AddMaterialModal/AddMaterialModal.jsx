import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Modal } from '../../../Ui/Modal/Modal';
import { Toolbar } from './Toolbar/Toolbar';
import { TagPicker } from './TagPicker/TagPicker';
import { AudioRecorder } from './AudioRecorder/AudioRecorder';
import { editorExtensions } from './editorExtensions';
import styles from './AddMaterialModal.module.css';

export function AddMaterialModal({ isOpen, onClose }) {
    const [tags, setTags] = useState([]);
    const [audioUrl, setAudioUrl] = useState(null);
    const [title, setTitle] = useState('');

    const editor = useEditor({
        extensions: editorExtensions,
        content: '',
    });

    const handleSave = () => {
        if (!editor) return;

        const material = {
            title: title || 'Без названия',
            content: editor.getHTML(),
            tags,
            audioUrl,
            createdAt: new Date().toISOString(),
        };

        console.log('Сохранённый материал:', material);

        editor.commands.clearContent();
        setTitle('');
        setTags([]);
        setAudioUrl(null);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Добавить материал">
            <input
                className={styles.titleInput}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Название материала..."
            />

            <div className={styles.editor}>
                <Toolbar editor={editor} />
                <EditorContent className={styles.editorContent} editor={editor} />
            </div>

            <TagPicker tags={tags} setTags={setTags} />

            <AudioRecorder audioUrl={audioUrl} setAudioUrl={setAudioUrl} />

            <button className={styles.saveBtn} onClick={handleSave}>
                Сохранить материал
            </button>
        </Modal>
    );
}