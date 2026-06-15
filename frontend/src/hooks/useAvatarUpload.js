import { useRef, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { usersApi } from '../api/users';
import { bumpAvatarCache } from '../utils/avatar';

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 МБ

export function useAvatarUpload() {
  const { refreshUser } = useAuth();
  const inputRef = useRef(null);

  const [previewSrc, setPreviewSrc] = useState(null); // dataURL для кропа
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pickFile = useCallback(() => {
    if (busy) return;
    inputRef.current?.click();
  }, [busy]);

  const onFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // позволяем выбрать тот же файл повторно
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Можно загружать только изображения');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('Файл больше 8 МБ');
      return;
    }

    setError(null);

    const reader = new FileReader();
    reader.onload = () => setPreviewSrc(reader.result);
    reader.onerror = () => setError('Не удалось прочитать файл');
    reader.readAsDataURL(file);
  }, []);

  const cancelCrop = useCallback(() => {
    if (busy) return;
    setPreviewSrc(null);
    setError(null);
  }, [busy]);

  const confirmCrop = useCallback(
    async (croppedFile) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        await usersApi.uploadAvatar(croppedFile);
        bumpAvatarCache();
        await refreshUser();
        setPreviewSrc(null);
      } catch (e) {
        setError(e.message || 'Не удалось загрузить аватар');
      } finally {
        setBusy(false);
      }
    },
    [busy, refreshUser],
  );

  const removeAvatar = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await usersApi.deleteAvatar();
      bumpAvatarCache();
      await refreshUser();
    } catch (e) {
      setError(e.message || 'Не удалось удалить аватар');
    } finally {
      setBusy(false);
    }
  }, [busy, refreshUser]);

  return {
    inputRef,
    previewSrc,
    busy,
    error,
    pickFile,
    onFileChange,
    cancelCrop,
    confirmCrop,
    removeAvatar,
  };
}