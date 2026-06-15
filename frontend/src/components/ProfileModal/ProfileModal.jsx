import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IoClose,
  IoSettingsOutline,
  IoPersonOutline,
  IoServerOutline,
  IoInformationCircleOutline,
  IoFolderOpenOutline,
  IoDocumentTextOutline,
  IoCloudDownloadOutline,
  IoCloudUploadOutline,
  IoLogOutOutline,
  IoTrashOutline,
  IoArchiveOutline,
} from 'react-icons/io5';
import styles from './ProfileModal.module.css';

import { useAvatarUpload } from '../../hooks/useAvatarUpload';
import { getAvatarUrl } from '../../utils/avatar';
import AvatarEditor from '../AvatarEditor';
import EditableField from './EditableField';

import { usersApi } from '../../api/users';
import { materialsApi } from '../../api/materials';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import useConfirm from '../../hooks/useConfirm';
import useTags from '../../hooks/useTags';

const tabs = [
  { id: 'general', label: 'Общие', icon: IoSettingsOutline },
  { id: 'profile', label: 'Профиль', icon: IoPersonOutline },
  { id: 'data', label: 'Данные', icon: IoServerOutline },
  { id: 'about', label: 'О приложении', icon: IoInformationCircleOutline },
];

function getVisibleEmail(user) {
  return (
    user?.email ||
    user?.mail ||
    user?.profile?.email ||
    user?.user?.email ||
    user?.raw?.email ||
    '—'
  );
}

function getErrorMessage(error, fallback = 'Произошла ошибка') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error?.message || error?.detail || fallback;
}

function countCollections(nodes = []) {
  let count = 0;

  for (const node of nodes || []) {
    if (node?.type === 'document') continue;
    count += 1;

    if (node.children?.length) {
      count += countCollections(
        node.children.filter((child) => child.type !== 'document'),
      );
    }
  }

  return count;
}

function flattenCollectionsForSelect(nodes, depth = 0, acc = []) {
  for (const node of nodes || []) {
    if (node?.type === 'document') continue;

    acc.push({
      id: node.id,
      name: `${'— '.repeat(depth)}${node.name}`,
    });

    if (node.children?.length) {
      flattenCollectionsForSelect(
        node.children.filter((child) => child.type !== 'document'),
        depth + 1,
        acc,
      );
    }
  }

  return acc;
}

function getMaterialSourceType(material) {
  const sourceType =
    material?.sourceType ??
    material?.source_type ??
    material?.raw?.source_type ??
    material?.raw?.sourceType ??
    (material?.filePath || material?.file_path || material?.raw?.file_path
      ? 'file'
      : 'text');

  return sourceType === 'file' ? 'file' : 'text';
}

function getMaterialCollectionId(material) {
  const raw =
    material?.collectionId ??
    material?.collection_id ??
    material?.collection?.id ??
    material?.raw?.collection_id ??
    material?.raw?.collectionId;

  return raw == null ? null : Number(raw);
}

function getMaterialTagIds(material) {
  if (Array.isArray(material?.tagIds)) {
    return material.tagIds.map(Number).filter((id) => Number.isFinite(id));
  }

  if (Array.isArray(material?.raw?.tag_ids)) {
    return material.raw.tag_ids
      .map(Number)
      .filter((id) => Number.isFinite(id));
  }

  if (Array.isArray(material?.tags)) {
    return material.tags
      .map((tag) => Number(tag?.id ?? tag))
      .filter((id) => Number.isFinite(id));
  }

  if (Array.isArray(material?.raw?.tags)) {
    return material.raw.tags
      .map((tag) => Number(tag?.id ?? tag))
      .filter((id) => Number.isFinite(id));
  }

  return [];
}

function buildCollectionNameMap(nodes, map = new Map()) {
  for (const node of nodes || []) {
    if (node?.type === 'document') continue;

    map.set(Number(node.id), node.name);

    if (node.children?.length) {
      buildCollectionNameMap(
        node.children.filter((child) => child.type !== 'document'),
        map,
      );
    }
  }

  return map;
}

function buildTagsNameMap(tags = []) {
  const map = new Map();

  for (const tag of tags || []) {
    map.set(Number(tag.id), tag.name);
  }

  return map;
}

function buildSummary(materials, pureCollections, availableTags) {
  const byType = { text: 0, file: 0 };
  const byCollectionMap = new Map();
  const byTagMap = new Map();

  const collectionNames = buildCollectionNameMap(pureCollections);
  const tagNames = buildTagsNameMap(availableTags);

  for (const material of materials || []) {
    const sourceType = getMaterialSourceType(material);
    byType[sourceType] += 1;

    const collectionId = getMaterialCollectionId(material);
    if (Number.isFinite(collectionId)) {
      const name =
        collectionNames.get(collectionId) || `Коллекция #${collectionId}`;
      const prev = byCollectionMap.get(collectionId) || {
        id: collectionId,
        name,
        count: 0,
      };
      prev.count += 1;
      byCollectionMap.set(collectionId, prev);
    }

    for (const tagId of getMaterialTagIds(material)) {
      const name = tagNames.get(tagId) || `Тег #${tagId}`;
      const prev = byTagMap.get(tagId) || { id: tagId, name, count: 0 };
      prev.count += 1;
      byTagMap.set(tagId, prev);
    }
  }

  const sortItems = (a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return String(a.name).localeCompare(String(b.name), 'ru');
  };

  return {
    total: materials.length,
    byType,
    byCollection: [...byCollectionMap.values()].sort(sortItems),
    byTag: [...byTagMap.values()].sort(sortItems),
  };
}

function downloadBlobAsFile(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download.bin';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function buildImportMessage(result) {
  const created =
    result?.createdCount ??
    result?.created_count ??
    result?.created ??
    result?.imported ??
    null;

  const skipped =
    result?.skippedCount ??
    result?.skipped_count ??
    result?.skipped ??
    null;

  if (created == null && skipped == null) {
    return result?.message || 'Импорт завершён';
  }

  const parts = [];
  if (created != null) parts.push(`создано: ${created}`);
  if (skipped != null) parts.push(`пропущено: ${skipped}`);

  return `Импорт завершён, ${parts.join(', ')}`;
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className={styles.statCard}>
      <Icon className={styles.statIcon} />
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

function SummaryList({ title, items, emptyText = 'Нет данных' }) {
  return (
    <div className={styles.dataListCard}>
      <div className={styles.dataListTitle}>{title}</div>

      {items.length === 0 ? (
        <div className={styles.dataListEmpty}>{emptyText}</div>
      ) : (
        <div>
          {items.slice(0, 10).map((item) => (
            <div key={`${title}-${item.id}`} className={styles.dataListRow}>
              <span className={styles.dataListRowName} title={item.name}>
                {item.name}
              </span>

              <strong className={styles.dataListRowCount}>{item.count}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TransferFormatCard({
  title,
  description,
  active,
  disabled = false,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        styles.transferFormatCard,
        active ? styles.transferFormatCardActive : '',
        disabled ? styles.transferFormatCardDisabled : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.transferFormatHead}>
        <span className={styles.transferFormatTitle}>{title}</span>
      </div>

      <div className={styles.transferFormatDescription}>{description}</div>
    </button>
  );
}

function TransferDialog({
  open,
  mode,
  collections = [],
  onClose,
  onSubmit,
}) {
  const options = useMemo(
    () => flattenCollectionsForSelect(collections),
    [collections],
  );

  const fileInputRef = useRef(null);
  const isExport = mode === 'export';

  const [collectionId, setCollectionId] = useState('');
  const [format, setFormat] = useState('csv');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!open) return;

    setCollectionId(String(options[0]?.id ?? ''));
    setFormat('csv');
    setFile(null);
    setError('');
    setSubmitting(false);
    setProgress(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [open, options]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key !== 'Escape' || submitting) return;
      e.preventDefault();
      onClose?.();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, submitting]);

  useEffect(() => {
    setError('');
    setFile(null);
    setProgress(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [format]);

  if (!open) return null;

  const csvHint = isExport
    ? 'CSV удобен для текстовых материалов. Файловые материалы не выгружаются как бинарные файлы.'
    : 'CSV-импорт предназначен для текстовых материалов.';

  const archiveHint = isExport
    ? 'Архив (.zip) выгружает файловые материалы выбранной коллекции.'
    : 'Архив (.zip) будет распакован, а файлы загрузятся в выбранную коллекцию как новые файловые материалы. Системные файлы будут пропущены.';

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !submitting) {
      onClose?.();
    }
  };

  const handleFileChange = (e) => {
    const nextFile = e.target.files?.[0] || null;

    if (!nextFile) {
      setFile(null);
      return;
    }

    const lowerName = String(nextFile.name || '').toLowerCase();

    if (format === 'csv' && !lowerName.endsWith('.csv')) {
      setError('Нужен файл в формате .csv');
      setFile(null);
      e.target.value = '';
      return;
    }

    if (format === 'archive' && !lowerName.endsWith('.zip')) {
      setError('Нужен файл архива в формате .zip');
      setFile(null);
      e.target.value = '';
      return;
    }

    setError('');
    setFile(nextFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setProgress(null);

    if (!collectionId) {
      setError('Выберите коллекцию');
      return;
    }

    if (!isExport && !file) {
      setError('Выберите файл');
      return;
    }

    try {
      setSubmitting(true);

      await onSubmit({
        mode,
        collectionId: Number(collectionId),
        format,
        file,
        onProgress: setProgress,
      });

      onClose?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Операция не выполнена'));
    } finally {
      setSubmitting(false);
    }
  };

  const progressPercent =
    progress?.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <div
      className={styles.transferBackdrop}
      onClick={handleOverlayClick}
      data-transfer-dialog="open"
    >
      <div className={styles.transferDialog} role="dialog" aria-modal="true">
        <div className={styles.transferDialogHeader}>
          <div className={styles.transferDialogTitle}>
            {isExport ? 'Экспорт данных' : 'Импорт данных'}
          </div>

          <button
            type="button"
            className={styles.transferDialogClose}
            onClick={onClose}
            disabled={submitting}
            aria-label="Закрыть"
          >
            <IoClose />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.transferForm}>
          <label className={styles.transferField}>
            <span className={styles.transferFieldLabel}>Коллекция</span>

            <select
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              disabled={submitting || options.length === 0}
              className={styles.transferSelect}
            >
              {options.length === 0 ? (
                <option value="">Нет доступных коллекций</option>
              ) : (
                options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <div className={styles.transferField}>
            <span className={styles.transferFieldLabel}>Формат</span>

            <div className={styles.transferFormatGrid}>
              <TransferFormatCard
                title="CSV"
                description={
                  isExport
                    ? 'Экспорт в табличный формат'
                    : 'Импорт текстовых материалов из CSV'
                }
                active={format === 'csv'}
                onClick={() => setFormat('csv')}
              />

              <TransferFormatCard
                title="Архив (.zip)"
                description={
                  isExport
                    ? 'Скачать файловые материалы архивом'
                    : 'Импорт файлов из ZIP-архива'
                }
                active={format === 'archive'}
                onClick={() => setFormat('archive')}
              />
            </div>
          </div>

          <div
            className={[
              styles.transferHint,
              format === 'csv'
                ? styles.transferHintWarning
                : styles.transferHintInfo,
            ].join(' ')}
          >
            {format === 'csv' ? csvHint : archiveHint}
          </div>

          {!isExport && (
            <label className={styles.transferField}>
              <span className={styles.transferFieldLabel}>
                {format === 'csv' ? 'CSV-файл' : 'ZIP-архив'}
              </span>

              <input
                ref={fileInputRef}
                type="file"
                accept={
                  format === 'csv'
                    ? '.csv,text/csv'
                    : '.zip,application/zip,application/x-zip-compressed'
                }
                onChange={handleFileChange}
                disabled={submitting}
                className={styles.transferInput}
              />

              <div
                className={styles.transferFileName}
                title={file?.name || 'Файл не выбран'}
              >
                {file?.name || 'Файл не выбран'}
              </div>
            </label>
          )}

          {!isExport && format === 'archive' && submitting && progress ? (
            <div className={styles.transferProgress}>
              <div className={styles.transferProgressMeta}>
                <span>
                  Импорт файла {progress.current} из {progress.total}
                </span>
                <strong>{progressPercent}%</strong>
              </div>

              <div className={styles.transferProgressBarTrack}>
                <div
                  className={styles.transferProgressBarFill}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div
                className={styles.transferFileName}
                title={progress.filename || ''}
              >
                Сейчас: {progress.filename || '—'}
              </div>
            </div>
          ) : null}

          {error ? <div className={styles.transferError}>{error}</div> : null}

          <div className={styles.transferActions}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className={styles.secondaryButton}
            >
              Отмена
            </button>

            <button
              type="submit"
              disabled={submitting || options.length === 0}
              className={styles.primaryButton}
            >
              {submitting
                ? isExport
                  ? 'Экспортируем…'
                  : 'Импортируем…'
                : isExport
                  ? 'Экспортировать'
                  : 'Импортировать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProfileModal({
  user,
  settings,
  stats,
  collections = [],
  materials = [],
  onClose,
  onUpdateSettings,
  onLogout,
  onDeleteAccount,
  onDataImported,
}) {
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;

      if (document.querySelector('[data-transfer-dialog="open"]')) {
        return;
      }

      onClose?.();
    };

    window.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Закрыть настройки"
          title="Закрыть (Esc)"
        >
          <IoClose />
        </button>

        <div className={styles.layout}>
          <nav className={styles.sidebar}>
            <h2 className={styles.title}>Настройки</h2>

            {tabs.map((tab) => {
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`${styles.tabButton} ${
                    activeTab === tab.id ? styles.tabButtonActive : ''
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon className={styles.tabIcon} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className={styles.content}>
            {activeTab === 'general' && (
              <GeneralTab
                settings={settings}
                onUpdateSettings={onUpdateSettings}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileTab
                user={user}
                onLogout={onLogout}
                onDeleteAccount={onDeleteAccount}
              />
            )}

            {activeTab === 'data' && (
              <DataTab
                stats={stats}
                collections={collections}
                materials={materials}
                onDataImported={onDataImported}
              />
            )}

            {activeTab === 'about' && <AboutTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════ ВКЛАДКА: ОБЩИЕ ═════════════════════════ */
function GeneralTab({ settings, onUpdateSettings }) {
  const handleChange = (key, value) => {
    onUpdateSettings?.({
      ...(settings || {}),
      [key]: value,
    });
  };

  return (
    <>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Тема</span>
        <select
          className={styles.select}
          value={settings?.theme || 'dark'}
          onChange={(e) => handleChange('theme', e.target.value)}
        >
          <option value="dark">Тёмная</option>
          <option value="light" disabled>
            Светлая (скоро)
          </option>
        </select>
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>Язык</span>
        <select
          className={styles.select}
          value={settings?.language || 'ru'}
          onChange={(e) => handleChange('language', e.target.value)}
        >
          <option value="ru">Русский</option>
          <option value="en" disabled>
            English (скоро)
          </option>
        </select>
      </div>

      <div className={`${styles.row} ${styles.rowDisabled}`}>
        <span className={styles.rowLabel}>
          Уведомления <span className={styles.soonBadge}>Скоро</span>
        </span>

        <label
          className={styles.toggle}
          title="Эта функция появится в следующих обновлениях"
        >
          <input type="checkbox" checked={false} disabled readOnly />
          <span className={styles.toggleSlider} />
        </label>
      </div>
    </>
  );
}

/* ═════════════════════════ ВКЛАДКА: ПРОФИЛЬ ═════════════════════════ */
function ProfileTab({ user, onLogout, onDeleteAccount }) {
  const {
    inputRef,
    previewSrc,
    busy,
    error: avatarError,
    pickFile,
    onFileChange,
    cancelCrop,
    confirmCrop,
    removeAvatar,
  } = useAvatarUpload();

  const { refreshUser } = useAuth();
  const { show } = useToast();
  const { confirm, confirmElement } = useConfirm();

  const avatarUrl = getAvatarUrl(user);
  const visibleEmail = getVisibleEmail(user);
  const initial = (user?.name || visibleEmail || '?')
    .trim()
    .charAt(0)
    .toUpperCase();

  const handleSaveName = async (newName) => {
    try {
      await usersApi.updateProfile({ display_name: newName });
      await refreshUser();
      show({ type: 'success', message: 'Имя сохранено' });
    } catch (err) {
      show({
        type: 'error',
        message: getErrorMessage(err, 'Не удалось сохранить имя'),
      });
      throw err;
    }
  };

  const handleConfirmCrop = async (file) => {
    try {
      await confirmCrop(file);
      await refreshUser?.();
      show({ type: 'success', message: 'Аватар обновлён' });
    } catch (err) {
      show({
        type: 'error',
        message: getErrorMessage(err, 'Не удалось загрузить аватар'),
      });
    }
  };

  const handleRemoveAvatar = async () => {
    const ok = await confirm({
      title: 'Удалить аватар?',
      message:
        'Аватар будет удалён. Восстановить нельзя — вы сможете загрузить новый.',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });

    if (!ok) return;

    try {
      await removeAvatar();
      await refreshUser?.();
      show({ type: 'success', message: 'Аватар удалён' });
    } catch (err) {
      show({
        type: 'error',
        message: getErrorMessage(err, 'Не удалось удалить аватар'),
      });
    }
  };

  const handleLogoutClick = async () => {
    const ok = await confirm({
      title: 'Выйти из аккаунта?',
      message:
        'Вы вернётесь к экрану входа. Все несохранённые данные останутся в браузере.',
      confirmLabel: 'Выйти',
      cancelLabel: 'Остаться',
      danger: false,
    });

    if (!ok) return;
    onLogout?.();
  };

  return (
    <>
      <div className={styles.avatarBlock}>
        <div className={styles.avatarBig}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" />
          ) : (
            <span className={styles.avatarInitial}>{initial}</span>
          )}
        </div>

        <div className={styles.avatarActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={pickFile}
            disabled={busy}
          >
            {busy ? 'Загружаем…' : avatarUrl ? 'Заменить' : 'Загрузить аватар'}
          </button>

          {avatarUrl && (
            <button
              type="button"
              className={styles.dangerButton}
              onClick={handleRemoveAvatar}
              disabled={busy}
            >
              Удалить
            </button>
          )}
        </div>

        {avatarError && <div className={styles.avatarError}>{avatarError}</div>}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onFileChange}
        />
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>Имя</span>
        <EditableField
          value={user?.name || ''}
          onSave={handleSaveName}
          placeholder="—"
          maxLength={100}
        />
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>Email</span>
        <span className={styles.rowValue} title={visibleEmail}>
          {visibleEmail}
        </span>
      </div>

      <div className={styles.dangerZone}>
        <div className={styles.dangerZoneTitle}>Управление аккаунтом</div>

        <button
          type="button"
          className={styles.dangerZoneAction}
          onClick={handleLogoutClick}
        >
          <IoLogOutOutline className={styles.dangerZoneIcon} />
          <div className={styles.dangerZoneText}>
            <div className={styles.dangerZoneLabel}>Выйти из аккаунта</div>
            <div className={styles.dangerZoneHint}>
              Завершить текущий сеанс на этом устройстве
            </div>
          </div>
        </button>

        {onDeleteAccount && (
          <button
            type="button"
            className={`${styles.dangerZoneAction} ${styles.dangerZoneActionDanger}`}
            onClick={() => onDeleteAccount()}
          >
            <IoTrashOutline className={styles.dangerZoneIcon} />
            <div className={styles.dangerZoneText}>
              <div className={styles.dangerZoneLabel}>Удалить аккаунт</div>
              <div className={styles.dangerZoneHint}>
                Полное удаление профиля и всех материалов
              </div>
            </div>
          </button>
        )}
      </div>

      {previewSrc && (
        <AvatarEditor
          src={previewSrc}
          busy={busy}
          onCancel={cancelCrop}
          onConfirm={handleConfirmCrop}
        />
      )}

      {confirmElement}
    </>
  );
}

/* ═════════════════════════ ВКЛАДКА: ДАННЫЕ ═════════════════════════ */
function DataTab({
  stats,
  collections = [],
  materials = [],
  onDataImported,
}) {
  const { show } = useToast();
  const { tags: availableTags } = useTags();

  const [transferModal, setTransferModal] = useState({
    open: false,
    mode: 'export',
  });

  const summary = useMemo(
    () => buildSummary(materials, collections, availableTags),
    [materials, collections, availableTags],
  );

  const totalCollections = stats?.collections ?? countCollections(collections);
  const totalMaterials = stats?.materials ?? materials.length;
  const hasCollections = countCollections(collections) > 0;

  const openExportModal = () => {
    setTransferModal({ open: true, mode: 'export' });
  };

  const openImportModal = () => {
    setTransferModal({ open: true, mode: 'import' });
  };

  const closeTransferModal = () => {
    setTransferModal((prev) => ({ ...prev, open: false }));
  };

  const handleTransferSubmit = async ({
    mode,
    collectionId,
    format,
    file,
    onProgress,
  }) => {
    if (mode === 'export') {
      if (format === 'csv') {
        const { blob, filename } = await materialsApi.exportCsv({
          collectionId,
        });

        downloadBlobAsFile(blob, filename);

        show({
          type: 'success',
          message: 'Экспорт CSV выполнен',
        });

        return;
      }

      const { blob, filename } = await materialsApi.exportFilesZip(collectionId);

      downloadBlobAsFile(blob, filename);

      show({
        type: 'success',
        message: 'Архив подготовлен',
      });

      return;
    }

    if (format === 'csv') {
      const result = await materialsApi.importCsv({
        collectionId,
        file,
      });

      await onDataImported?.(result);

      show({
        type: 'success',
        message: buildImportMessage(result),
      });

      return;
    }

    const result = await materialsApi.importArchive({
      collectionId,
      file,
      onProgress,
    });

    await onDataImported?.(result);

    show({
      type: 'success',
      message: result?.message || buildImportMessage(result),
    });
  };

  return (
    <>
      <div className={styles.statGrid}>
        <StatCard
          icon={IoFolderOpenOutline}
          label="Коллекций"
          value={totalCollections}
        />

        <StatCard
          icon={IoDocumentTextOutline}
          label="Материалов"
          value={totalMaterials}
        />

        <StatCard
          icon={IoDocumentTextOutline}
          label="Текстовые"
          value={summary.byType.text}
        />

        <StatCard
          icon={IoArchiveOutline}
          label="Файловые"
          value={summary.byType.file}
        />
      </div>

      <div className={styles.dataActions}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={openExportModal}
          disabled={!hasCollections}
        >
          <IoCloudDownloadOutline className={styles.buttonIcon} />
          <span>Экспорт данных</span>
        </button>

        <button
          type="button"
          className={styles.secondaryButton}
          onClick={openImportModal}
          disabled={!hasCollections}
        >
          <IoCloudUploadOutline className={styles.buttonIcon} />
          <span>Импорт данных</span>
        </button>
      </div>

      {!hasCollections && (
        <div className={styles.dataNote}>
          Сначала создайте хотя бы одну коллекцию, чтобы импортировать или
          экспортировать данные.
        </div>
      )}

      <div className={styles.dataNote}>
        CSV — для текстовых материалов. Архив (.zip) — для файловых материалов.
      </div>

      <div className={styles.dataListGrid}>
        <SummaryList
          title="Материалы по коллекциям"
          items={summary.byCollection}
          emptyText="В коллекциях пока нет материалов"
        />

        <SummaryList
          title="Материалы по тегам"
          items={summary.byTag}
          emptyText="У материалов пока нет тегов"
        />
      </div>

      <TransferDialog
        open={transferModal.open}
        mode={transferModal.mode}
        collections={collections}
        onClose={closeTransferModal}
        onSubmit={handleTransferSubmit}
      />
    </>
  );
}

/* ═════════════════════════ ВКЛАДКА: О ПРИЛОЖЕНИИ ═════════════════════════ */
function AboutTab() {
  return (
    <>
      <div className={styles.aboutHero}>
        <div className={styles.aboutLogo}>🌊</div>
        <div className={styles.aboutName}>Омут памяти</div>
        <div className={styles.aboutTagline}>Ваша персональная база знаний</div>
        <div className={styles.aboutVersion}>версия 0.1.0</div>
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>Разработчики</span>
        <span className={styles.rowValue}>Команда HSE</span>
      </div>

      <div className={styles.aboutFooter}>
        <a
          className={styles.aboutLink}
          href="/terms.html"
          target="_blank"
          rel="noreferrer"
        >
          Пользовательское соглашение
        </a>

        <span className={styles.aboutDot}>·</span>

        <a
          className={styles.aboutLink}
          href="/privacy.html"
          target="_blank"
          rel="noreferrer"
        >
          Политика конфиденциальности
        </a>
      </div>
    </>
  );
}