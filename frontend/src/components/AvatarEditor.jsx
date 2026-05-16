import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImageFile } from '../utils/cropImage';
import styles from './AvatarEditor.module.css';

export default function AvatarEditor({ src, onCancel, onConfirm, busy = false }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPx, setAreaPx] = useState(null);
  const [localError, setLocalError] = useState(null);

  const onCropComplete = useCallback((_area, areaPixels) => {
    setAreaPx(areaPixels);
  }, []);

  const handleBackdropClick = () => {
    if (busy) return; // не закрываем во время загрузки
    onCancel?.();
  };

  const handleSave = async () => {
    if (!areaPx || busy) return;
    try {
      setLocalError(null);
      const file = await getCroppedImageFile(src, areaPx);
      await onConfirm?.(file);
    } catch (e) {
      setLocalError(e.message || 'Ошибка обрезки изображения');
    }
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>Обрезка аватара</div>

        <div className={styles.cropArea}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className={styles.controls}>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={busy}
          />
        </div>

        {localError && <div className={styles.error}>{localError}</div>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={onCancel}
            disabled={busy}
          >
            Отмена
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleSave}
            disabled={busy || !areaPx}
          >
            {busy ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}