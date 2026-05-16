import { useCallback } from 'react';
import { ACTIONS } from '../state';
import { releaseFilePreview } from '../../../../../utils/filePreview';
import FileItem from './FileItem';
import styles from './FilesList.module.css';

export default function FilesList({ files, dispatch }) {
    const handleRemove = useCallback((id) => {
        // ✅ Освобождаем blob URL до удаления из state
        const item = files.find((f) => f.id === id);
        if (item?.file) releaseFilePreview(item.file);

        dispatch({ type: ACTIONS.REMOVE_FILE, payload: id });
    }, [files, dispatch]);

    const handleToggleImportant = useCallback((id) => {
        dispatch({ type: ACTIONS.TOGGLE_FILE_IMPORTANT, payload: id });
    }, [dispatch]);

    const handleUpdateTags = useCallback((id, tags) => {
        dispatch({ type: ACTIONS.UPDATE_FILE_TAGS, payload: { id, tags } });
    }, [dispatch]);

    if (files.length === 0) return null;

    return (
        <div className={styles.list} role="list" aria-label="Прикреплённые файлы">
            {files.map((item) => (
                <FileItem
                    key={item.id}
                    item={item}
                    onRemove={() => handleRemove(item.id)}
                    onToggleImportant={() => handleToggleImportant(item.id)}
                    onUpdateTags={(tags) => handleUpdateTags(item.id, tags)}
                />
            ))}
        </div>
    );
}