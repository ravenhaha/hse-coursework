import {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  IoWater,
  IoHome,
  IoLayersOutline,
  IoDocumentTextOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoAddOutline,
  IoFolderOpenOutline,
  IoSearchOutline,
  IoStatsChartOutline,
} from 'react-icons/io5';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  pointerWithin,
} from '@dnd-kit/core';

import SidebarSection from './SidebarSection';
import TreeItem from './TreeItem';
import UserPanel from './UserPanel';
import ContextMenu from './ContextMenu';
import EmptyState from './EmptyState';
import useConfirm from '../../../../hooks/useConfirm';
import { useToast } from '../../../../hooks/useToast';
import FiltersBar from './FilterBar/FilterBar';
import AddMaterialModal from '../AddMaterialModal/AddMaterialModal';
import { filterTree, filterFlat } from './filters';
import { isDescendant, findCollectionParent } from './dndUtils';
import useTags from '../../../../hooks/useTags';
import { Modal } from '../../../Ui/Modal/Modal';
import { materialsApi } from '../../../../api/materials';
import styles from './Sidebar.module.css';

const INITIAL_FILTERS = {
  collectionId: null,
  tagIds: [],
  onlyImportant: false,
  kind: null,
  dateFrom: null,
  dateTo: null,
  period: 'all',
};

const isFiltersEmpty = (f) =>
  f.collectionId == null &&
  (f.tagIds?.length ?? 0) === 0 &&
  !f.onlyImportant &&
  !f.kind &&
  !f.dateFrom &&
  !f.dateTo;

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 500;
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_WIDTH_KEY = 'sidebarWidth';

class NoDndPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown',
      handler: ({ nativeEvent: event }) => {
        if (!event.isPrimary || event.button !== 0) return false;
        let el = event.target;
        while (el) {
          if (el.dataset && el.dataset.noDnd !== undefined) return false;
          el = el.parentElement;
        }
        return true;
      },
    },
  ];
}

function flattenCollectionsForSelect(nodes, depth = 0, acc = []) {
  for (const node of nodes || []) {
    if (node.type === 'document') continue;

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
      .map((tag) => Number(tag?.id))
      .filter((id) => Number.isFinite(id));
  }

  return [];
}

function buildCollectionNameMap(nodes, map = new Map()) {
  for (const node of nodes || []) {
    map.set(Number(node.id), node.name);
    if (node.children?.length) {
      buildCollectionNameMap(node.children, map);
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
    return 'Импорт завершён';
  }

  const parts = [];
  if (created != null) parts.push(`создано: ${created}`);
  if (skipped != null) parts.push(`пропущено: ${skipped}`);

  return `Импорт завершён, ${parts.join(', ')}`;
}

function StatCard({ label, value }) {
  return (
    <div className={styles.materialsStatCard}>
      <div className={styles.materialsStatLabel}>{label}</div>
      <div className={styles.materialsStatValue}>{value}</div>
    </div>
  );
}

function SmallList({ title, items }) {
  return (
    <div className={styles.materialsSummaryList}>
      <div className={styles.materialsSummaryListTitle}>{title}</div>

      {items.length === 0 ? (
        <div className={styles.materialsSummaryEmpty}>Нет данных</div>
      ) : (
        <div>
          {items.slice(0, 5).map((item) => (
            <div
              key={`${title}-${item.id}`}
              className={styles.materialsSummaryRow}
            >
              <span
                className={styles.materialsSummaryRowName}
                title={item.name}
              >
                {item.name}
              </span>
              <strong className={styles.materialsSummaryRowCount}>
                {item.count}
              </strong>
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
  badge = '',
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
        {badge ? (
          <span className={styles.transferFormatBadge}>{badge}</span>
        ) : null}
      </div>

      <div className={styles.transferFormatDescription}>{description}</div>
    </button>
  );
}

function DataTransferModal({
  isOpen,
  mode,
  onClose,
  collections = [],
  onSubmit,
  initialCollectionId = null,
}) {
  const options = useMemo(
    () => flattenCollectionsForSelect(collections),
    [collections],
  );

  const isExport = mode === 'export';

  const [collectionId, setCollectionId] = useState('');
  const [format, setFormat] = useState('csv');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const fallbackId = initialCollectionId ?? options[0]?.id ?? '';
    setCollectionId(String(fallbackId));
    setFormat('csv');
    setFile(null);
    setError('');
    setSubmitting(false);
  }, [isOpen, initialCollectionId, options, mode]);

  const csvHint = isExport
    ? 'CSV подходит в первую очередь для текстовых материалов. Файловые материалы не выгружаются как бинарные файлы.'
    : 'CSV-импорт работает только для текстовых материалов.';

  const archiveHint = isExport
    ? 'ZIP собирается только из файловых материалов выбранной коллекции.'
    : 'Импорт архива пока не поддерживается на сервере.';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!collectionId) {
      setError('Выберите коллекцию');
      return;
    }

    if (!isExport) {
      if (format === 'archive') {
        setError('Импорт архива пока не поддерживается');
        return;
      }

      if (!file) {
        setError('Выберите файл');
        return;
      }
    }

    try {
      setSubmitting(true);

      await onSubmit({
        mode,
        collectionId: Number(collectionId),
        format,
        file,
      });

      onClose();
    } catch (err) {
      setError(err?.message || 'Операция не выполнена');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isExport ? 'Экспорт данных' : 'Импорт данных'}
    >
      <form onSubmit={handleSubmit} className={styles.transferModalBody}>
        <label className={styles.transferField}>
          <span className={styles.transferLabel}>Коллекция</span>
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
          <span className={styles.transferLabel}>Формат</span>

          <div className={styles.transferFormatGrid}>
            <TransferFormatCard
              title="CSV"
              description={
                isExport
                  ? 'Экспорт данных в табличный формат'
                  : 'Импорт текстовых материалов из CSV'
              }
              active={format === 'csv'}
              onClick={() => setFormat('csv')}
            />

            <TransferFormatCard
              title="Архив (.zip)"
              description={
                isExport
                  ? 'Скачать файлы выбранной коллекции архивом'
                  : 'Импорт из архива'
              }
              active={format === 'archive'}
              disabled={!isExport}
              badge={!isExport ? 'скоро' : ''}
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
            <span className={styles.transferLabel}>
              {format === 'csv' ? 'CSV-файл' : 'Архив (.zip)'}
            </span>

            <input
              type="file"
              accept={format === 'csv' ? '.csv,text/csv' : '.zip,application/zip'}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={submitting}
              className={styles.transferInput}
            />
          </label>
        )}

        {error ? <div className={styles.transferError}>{error}</div> : null}

        <div className={styles.transferActions}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={styles.importCsvBtnSecondary}
          >
            Отмена
          </button>

          <button
            type="submit"
            disabled={submitting || options.length === 0}
            className={styles.importCsvBtn}
          >
            {submitting
              ? isExport
                ? 'Экспорт…'
                : 'Импорт…'
              : isExport
                ? 'Экспортировать'
                : 'Импортировать'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MaterialsSummaryPanel({
  summary,
  onOpenExport,
  onOpenImport,
  canTransfer = true,
  note = '',
  title = 'Статистика, CSV и архив',
}) {
  if (!summary) return null;

  return (
    <div data-no-dnd className={styles.materialsSummaryPanel}>
      <div className={styles.materialsSummaryHeader}>
        <div className={styles.materialsSummaryTitle}>{title}</div>

        <div className={styles.materialsSummaryActions}>
          <button
            type="button"
            onClick={onOpenExport}
            disabled={!canTransfer}
            className={styles.materialsSummaryBtn}
          >
            Экспорт данных
          </button>

          <button
            type="button"
            onClick={onOpenImport}
            disabled={!canTransfer}
            className={styles.materialsSummaryBtnGhost}
          >
            Импорт данных
          </button>
        </div>
      </div>

      <div className={styles.materialsStatsGrid}>
        <StatCard label="Всего" value={summary.total} />
        <StatCard label="Текстовые" value={summary.byType.text} />
        <StatCard label="Файловые" value={summary.byType.file} />
      </div>

      <div className={styles.materialsSummaryLists}>
        <SmallList title="По коллекциям" items={summary.byCollection} />
        <SmallList title="По тегам" items={summary.byTag} />
      </div>

      {note ? <div className={styles.materialsSummaryNote}>{note}</div> : null}
    </div>
  );
}

function AllMaterialsSectionContent({
  search,
  filteredMaterials,
  materials,
  filters,
  setFilters,
  activeItemId,
  onSelectItem,
  onContextMenu,
  onKebabMenu,
  renamingKey,
  onRenameSubmit,
  onRenameCancel,
  onSearchSync,
}) {
  useEffect(() => {
    onSearchSync?.(search);
  }, [search, onSearchSync]);

  const visible = useMemo(
    () => filterFlat(filteredMaterials, search),
    [filteredMaterials, search],
  );

  const filtersActive = !isFiltersEmpty(filters);

  return (
    <>
      <FiltersBar filters={filters} onChange={setFilters} />

      {materials.length > 0 && visible.length === 0 && (
        <EmptyState
          icon={IoSearchOutline}
          title="Ничего не подходит"
          description={
            search
              ? `По запросу «${search}» ничего не найдено.`
              : 'Под текущие фильтры ничего не подходит.'
          }
          size="sm"
          actionLabel={filtersActive ? 'Сбросить фильтры' : undefined}
          onAction={
            filtersActive ? () => setFilters(INITIAL_FILTERS) : undefined
          }
        />
      )}

      {visible.map((item) => (
        <TreeItem
          key={item.id}
          item={item}
          section="all"
          activeItemId={activeItemId}
          onItemClick={(it) => onSelectItem?.(it.id, 'document')}
          onContextMenu={onContextMenu}
          onKebabMenu={onKebabMenu}
          renamingKey={renamingKey}
          onRenameSubmit={onRenameSubmit}
          onRenameCancel={onRenameCancel}
          draggable
        />
      ))}
    </>
  );
}

function StatsSectionContent({
  filteredMaterials,
  search,
  pureCollections,
  availableTags,
  filters,
  onOpenExport,
  onOpenImport,
}) {
  const visible = useMemo(
    () => filterFlat(filteredMaterials, search),
    [filteredMaterials, search],
  );

  const summary = useMemo(
    () => buildSummary(visible, pureCollections, availableTags),
    [visible, pureCollections, availableTags],
  );

  const unsupportedServerFilters =
    !!filters.onlyImportant ||
    !!filters.kind ||
    !!filters.dateFrom ||
    !!filters.dateTo ||
    (filters.period && filters.period !== 'all');

  const noteParts = [
    'Для CSV используются текущий поиск и фильтр по тегам из раздела «Все материалы». Коллекция выбирается в окне экспорта/импорта.',
  ];

  if (search) {
    noteParts.push(`Текущий поиск: «${search}».`);
  }

  if (unsupportedServerFilters) {
    noteParts.push(
      'Важно: CSV-экспорт сейчас учитывает только поиск, коллекцию и теги.',
    );
  }

  return (
    <MaterialsSummaryPanel
      summary={summary}
      onOpenExport={onOpenExport}
      onOpenImport={onOpenImport}
      canTransfer={pureCollections.length > 0}
      note={noteParts.join(' ')}
      title="Статистика, CSV и архив"
    />
  );
}

function Sidebar(
  {
    collections = [],
    pureCollections = [],
    materials = [],
    user = null,
    activeItemId = null,
    homeOpen = false,
    isFirstCollection = false,
    onSelectItem,
    onCreateCollection,
    onCreateSubcollection,
    onAddMaterial,
    onAddMaterialToFolder,
    onRenameItem,
    onDeleteItem,
    onRestoreItem,
    onCommitDelete,
    onMoveItem,
    onNavigateHome,
    onSettings,
    onLogout,
    onImportCompleted,
  },
  ref,
) {
  const [expandedFolders, setExpandedFolders] = useState({});
  const [ctxMenu, setCtxMenu] = useState(null);
  const [renamingKey, setRenamingKey] = useState(null);
  const [addModal, setAddModal] = useState({ open: false, parentId: null });
  const [creatingInFolderId, setCreatingInFolderId] = useState(null);
  const [externalCreateTick, setExternalCreateTick] = useState(0);
  const [transferModal, setTransferModal] = useState({
    open: false,
    mode: 'export',
  });
  const [materialsSearch, setMaterialsSearch] = useState('');

  const { confirm, confirmElement } = useConfirm();
  const { show: showToast } = useToast();
  const { tags: availableTags } = useTags();

  useImperativeHandle(
    ref,
    () => ({
      startCreateCollection: () => {
        setExternalCreateTick((n) => n + 1);
      },
    }),
    [],
  );

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') return SIDEBAR_DEFAULT_WIDTH;
    const saved = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (!saved || Number.isNaN(saved)) return SIDEBAR_DEFAULT_WIDTH;
    return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, saved));
  });
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
    document.documentElement.style.setProperty(
      '--sidebar-width',
      `${sidebarWidth}px`,
    );
  }, [sidebarWidth]);

  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty('--sidebar-width');
    };
  }, []);

  const handleResizeStart = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startW = sidebarWidth;
      setIsResizing(true);

      const onMove = (ev) => {
        const next = Math.min(
          SIDEBAR_MAX_WIDTH,
          Math.max(SIDEBAR_MIN_WIDTH, startW + ev.clientX - startX),
        );
        setSidebarWidth(next);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setIsResizing(false);
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [sidebarWidth],
  );

  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const filteredMaterials = useMemo(() => {
    const { dateFrom, dateTo } = filters;

    return materials.filter((m) => {
      const materialCollectionId = getMaterialCollectionId(m);

      if (
        filters.collectionId != null &&
        Number(materialCollectionId) !== Number(filters.collectionId)
      ) {
        return false;
      }

      if (filters.tagIds.length > 0) {
        const tagIds = getMaterialTagIds(m);
        const has = filters.tagIds.every((id) => tagIds.includes(Number(id)));
        if (!has) return false;
      }

      if (filters.onlyImportant && !m.isImportant) return false;
      if (filters.kind && m.kind !== filters.kind) return false;

      if ((dateFrom || dateTo) && m.createdAt) {
        const d = new Date(m.createdAt).toISOString().slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }

      return true;
    });
  }, [materials, filters]);

  const [activeDrag, setActiveDrag] = useState(null);
  const hoverTimerRef = useRef(null);
  const hoverFolderRef = useRef(null);

  const sensors = useSensors(
    useSensor(NoDndPointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleToggleFolder = useCallback((id) => {
    setExpandedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleExpandFolder = useCallback((id) => {
    setExpandedFolders((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);

  const handleCollapseAll = useCallback(() => {
    setExpandedFolders({});
  }, []);

  const handleItemClick = useCallback(
    (item) => {
      if (item.type === 'folder') {
        handleToggleFolder(item.id);
        onSelectItem?.(item.id, 'folder');
      } else {
        onSelectItem?.(item.id, 'document');
      }
    },
    [handleToggleFolder, onSelectItem],
  );

  const handleRequestAddToFolder = useCallback(
    (folder) => {
      handleExpandFolder(folder.id);
      setAddModal({ open: true, parentId: folder.id });
    },
    [handleExpandFolder],
  );

  const handleRequestAddSubcollection = useCallback(
    (folder) => {
      handleExpandFolder(folder.id);
      setCreatingInFolderId(folder.id);
    },
    [handleExpandFolder],
  );

  const handleSubmitSubcollection = useCallback(
    (parentId, name) => {
      const trimmed = name?.trim();
      if (trimmed) onCreateSubcollection?.(parentId, trimmed);
      setCreatingInFolderId(null);
    },
    [onCreateSubcollection],
  );

  const handleCancelSubcollection = useCallback(() => {
    setCreatingInFolderId(null);
  }, []);

  const handleCloseAddModal = useCallback(() => {
    setAddModal({ open: false, parentId: null });
  }, []);

  const handleSubmitAddModal = useCallback(
    async (data) => {
      if (addModal.parentId) {
        await onAddMaterialToFolder?.(addModal.parentId, data);
      } else {
        await onAddMaterial?.(data);
      }
      handleCloseAddModal();
    },
    [
      addModal.parentId,
      onAddMaterialToFolder,
      onAddMaterial,
      handleCloseAddModal,
    ],
  );

  const handleSoftDelete = useCallback(
    (item, itemType) => {
      onDeleteItem?.(item.id, itemType);

      showToast({
        message:
          itemType === 'folder'
            ? `Коллекция «${item.name}» удалена`
            : `Материал «${item.name}» удалён`,
        type: 'success',
        actionLabel: 'Отменить',
        duration: 5000,
        onAction: () => {
          onRestoreItem?.(item, itemType);
        },
        onDismiss: () => {
          onCommitDelete?.(item.id, itemType);
        },
      });
    },
    [onDeleteItem, onRestoreItem, onCommitDelete, showToast],
  );

  const buildMenuItems = useCallback(
    (item, section = 'tree') => {
      const itemType = item.type || 'document';
      const normalizedItem = { ...item, type: itemType };

      const items = [
        {
          label: 'Переименовать',
          icon: IoPencilOutline,
          onClick: () => {
            setRenamingKey(`${section}:${itemType}:${normalizedItem.id}`);
          },
        },
      ];

      if (itemType === 'folder') {
        items.push({
          label: 'Добавить материал',
          icon: IoAddOutline,
          onClick: () => handleRequestAddToFolder(normalizedItem),
        });
        items.push({
          label: 'Добавить подколлекцию',
          icon: IoFolderOpenOutline,
          onClick: () => handleRequestAddSubcollection(normalizedItem),
        });
      }

      items.push(
        { divider: true },
        {
          label: 'Удалить',
          icon: IoTrashOutline,
          danger: true,
          onClick: async () => {
            const ok = await confirm({
              title:
                itemType === 'folder'
                  ? `Удалить коллекцию «${normalizedItem.name}»?`
                  : `Удалить «${normalizedItem.name}»?`,
              message:
                itemType === 'folder'
                  ? 'Вложенные подколлекции и материалы тоже будут удалены. Действие необратимо.'
                  : 'Действие необратимо.',
              confirmLabel: 'Удалить',
              cancelLabel: 'Отмена',
              danger: true,
            });
            if (!ok) return;

            handleSoftDelete(normalizedItem, itemType);
          },
        },
      );

      return items;
    },
    [
      handleRequestAddToFolder,
      handleRequestAddSubcollection,
      confirm,
      handleSoftDelete,
    ],
  );

  const handleContextMenu = useCallback(
    (e, item, section = 'tree') => {
      const items = buildMenuItems(item, section);
      setCtxMenu({ x: e.clientX, y: e.clientY, items });
    },
    [buildMenuItems],
  );

  const handleKebabMenu = useCallback(
    (item, anchorEl, section = 'tree') => {
      const items = buildMenuItems(item, section);
      if (!anchorEl) return;
      const rect = anchorEl.getBoundingClientRect();
      setCtxMenu({
        x: rect.right,
        y: rect.bottom + 4,
        items,
      });
    },
    [buildMenuItems],
  );

  const handleContextMenuTree = useCallback(
    (e, item) => handleContextMenu(e, item, 'tree'),
    [handleContextMenu],
  );

  const handleContextMenuAll = useCallback(
    (e, item) => handleContextMenu(e, item, 'all'),
    [handleContextMenu],
  );

  const handleKebabTree = useCallback(
    (item, anchorEl) => handleKebabMenu(item, anchorEl, 'tree'),
    [handleKebabMenu],
  );

  const handleKebabAll = useCallback(
    (item, anchorEl) => handleKebabMenu(item, anchorEl, 'all'),
    [handleKebabMenu],
  );

  const handleRenameSubmit = useCallback(
    (id, name, type) => {
      const finalType = type || 'document';
      onRenameItem?.(id, name, finalType);
      setRenamingKey(null);

      showToast({
        message: 'Переименовано',
        type: 'success',
        duration: 2000,
      });
    },
    [onRenameItem, showToast],
  );

  const handleRenameCancel = useCallback(() => {
    setRenamingKey(null);
  }, []);

  const handleDragStart = useCallback((event) => {
    const { active } = event;
    setActiveDrag(active.data.current || null);
  }, []);

  const handleDragOver = useCallback(
    (event) => {
      const { over } = event;
      const overId =
        over?.data?.current?.kind === 'folder' ? over.data.current.id : null;

      if (overId !== hoverFolderRef.current) {
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
        hoverFolderRef.current = overId;

        if (overId != null) {
          hoverTimerRef.current = setTimeout(() => {
            handleExpandFolder(overId);
            hoverTimerRef.current = null;
          }, 600);
        }
      }
    },
    [handleExpandFolder],
  );

  const handleDragEnd = useCallback(
    (event) => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      hoverFolderRef.current = null;
      setActiveDrag(null);

      const { active, over } = event;
      if (!over) return;

      const dragData = active.data.current;
      const dropData = over.data.current;
      if (!dragData || !dropData) return;

      const itemId = dragData.id;
      const itemType = dragData.type;
      const targetParentId = dropData.kind === 'root' ? null : dropData.id;

      const itemIdNum = Number(itemId);
      const targetParentIdNum =
        targetParentId == null ? null : Number(targetParentId);

      if (itemType === 'document' && targetParentIdNum == null) return;

      if (itemType === 'folder') {
        if (itemIdNum === targetParentIdNum) return;
        if (
          targetParentIdNum != null &&
          isDescendant(collections, itemIdNum, targetParentIdNum)
        ) {
          return;
        }
        const currentParent = findCollectionParent(collections, itemIdNum);
        const currentParentNum =
          currentParent == null ? null : Number(currentParent);
        if (currentParentNum === targetParentIdNum) return;
      } else {
        const currentCollectionId = dragData.currentParentId;
        const currentCollectionIdNum =
          currentCollectionId == null ? null : Number(currentCollectionId);
        if (currentCollectionIdNum === targetParentIdNum) return;
      }

      onMoveItem?.(itemIdNum, itemType, targetParentIdNum);

      showToast({
        message:
          itemType === 'folder' ? 'Коллекция перемещена' : 'Материал перемещён',
        type: 'success',
        duration: 2000,
      });
    },
    [collections, onMoveItem, showToast],
  );

  const handleDragCancel = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    hoverFolderRef.current = null;
    setActiveDrag(null);
  }, []);

  const openExportModal = useCallback(() => {
    setTransferModal({ open: true, mode: 'export' });
  }, []);

  const openImportModal = useCallback(() => {
    setTransferModal({ open: true, mode: 'import' });
  }, []);

  const closeTransferModal = useCallback(() => {
    setTransferModal((prev) => ({ ...prev, open: false }));
  }, []);

  const handleTransferSubmit = useCallback(
    async ({ mode, collectionId, format, file }) => {
      if (mode === 'export') {
        if (format === 'csv') {
          const { blob, filename } = await materialsApi.exportCsv({
            q: materialsSearch,
            collectionId,
            tagIds: filters.tagIds,
          });

          downloadBlobAsFile(blob, filename);

          showToast({
            message: 'Экспорт CSV выполнен',
            type: 'success',
            duration: 2500,
          });

          return;
        }

        const { blob, filename } = await materialsApi.exportFilesZip(collectionId);

        downloadBlobAsFile(blob, filename);

        showToast({
          message: 'Архив подготовлен',
          type: 'success',
          duration: 2500,
        });

        return;
      }

      if (format === 'archive') {
        throw new Error('Импорт архива пока не поддерживается на сервере');
      }

      const result = await materialsApi.importCsv({
        collectionId,
        file,
      });

      await onImportCompleted?.();

      showToast({
        message: buildImportMessage(result),
        type: 'success',
        duration: 3500,
      });
    },
    [filters.tagIds, materialsSearch, onImportCompleted, showToast],
  );

  const renderCollectionsTree = (search, startCreate) => {
    const filtered = filterTree(collections, search);

    if (collections.length === 0 && !search) {
      return (
        <EmptyState
          icon={IoLayersOutline}
          title="Здесь будут ваши коллекции"
          description="Создайте первую коллекцию, чтобы организовать материалы по темам."
          actionLabel="Создать коллекцию"
          onAction={startCreate}
        />
      );
    }

    if (filtered.length === 0 && search) {
      return (
        <EmptyState
          icon={IoSearchOutline}
          title="Ничего не найдено"
          description={`По запросу «${search}» нет коллекций.`}
          size="sm"
        />
      );
    }

    return filtered.map((item) => (
      <TreeItem
        key={item.id}
        item={item}
        section="tree"
        activeItemId={activeItemId}
        expandedFolders={
          search
            ? Object.fromEntries(collections.map((c) => [c.id, true]))
            : expandedFolders
        }
        onItemClick={handleItemClick}
        onToggleFolder={handleToggleFolder}
        onExpandFolder={handleExpandFolder}
        onRequestAdd={handleRequestAddToFolder}
        onContextMenu={handleContextMenuTree}
        onKebabMenu={handleKebabTree}
        renamingKey={renamingKey}
        onRenameSubmit={handleRenameSubmit}
        onRenameCancel={handleRenameCancel}
        creatingInFolderId={creatingInFolderId}
        onSubmitSubcollection={handleSubmitSubcollection}
        onCancelSubcollection={handleCancelSubcollection}
        draggable
      />
    ));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <aside className={styles.sidebar}>
        <div className={styles.scrollArea}>
          <div className={styles.logo}>
            <IoWater className={styles.logoIcon} />
            <span className={styles.logoText}>Омут памяти</span>
          </div>

          <nav className={styles.nav}>
            <button
              className={`${styles.navItem} ${homeOpen ? styles.navItemActive : ''}`}
              onClick={() => onNavigateHome?.()}
              title="Открыть справку"
            >
              <IoHome className={styles.navIcon} />
              <span>Главная</span>
            </button>
          </nav>

          <SidebarSection
            icon={IoLayersOutline}
            title="Коллекция"
            addTitle="Создать коллекцию"
            inlineCreate
            onAdd={onCreateCollection}
            onCollapseAll={handleCollapseAll}
            stickyBreadcrumb
            droppableRoot
            searchPlaceholder="Поиск в коллекциях…"
            createPlaceholder="Название коллекции…"
            externalCreateTick={externalCreateTick}
            hintFirstTime={isFirstCollection}
          >
            {(search, startCreate) => renderCollectionsTree(search, startCreate)}
          </SidebarSection>

          <SidebarSection
            icon={IoDocumentTextOutline}
            title="Все материалы"
            hideAddButton
            searchPlaceholder="Поиск материалов…"
          >
            {(search) => (
              <AllMaterialsSectionContent
                search={search}
                filteredMaterials={filteredMaterials}
                materials={materials}
                filters={filters}
                setFilters={setFilters}
                activeItemId={activeItemId}
                onSelectItem={onSelectItem}
                onContextMenu={handleContextMenuAll}
                onKebabMenu={handleKebabAll}
                renamingKey={renamingKey}
                onRenameSubmit={handleRenameSubmit}
                onRenameCancel={handleRenameCancel}
                onSearchSync={setMaterialsSearch}
              />
            )}
          </SidebarSection>

          <SidebarSection
            icon={IoStatsChartOutline}
            title="Статистика, CSV и архив"
            hideAddButton
          >
            {() => (
              <StatsSectionContent
                filteredMaterials={filteredMaterials}
                search={materialsSearch}
                pureCollections={pureCollections}
                availableTags={availableTags}
                filters={filters}
                onOpenExport={openExportModal}
                onOpenImport={openImportModal}
              />
            )}
          </SidebarSection>
        </div>

        <UserPanel user={user} onSettings={onSettings} onLogout={onLogout} />

        {ctxMenu && (
          <ContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            items={ctxMenu.items}
            onClose={() => setCtxMenu(null)}
          />
        )}

        <AddMaterialModal
          isOpen={addModal.open}
          onClose={handleCloseAddModal}
          onSubmit={handleSubmitAddModal}
          initialCollection={addModal.parentId}
          collections={pureCollections}
        />

        <DataTransferModal
          isOpen={transferModal.open}
          mode={transferModal.mode}
          onClose={closeTransferModal}
          collections={pureCollections}
          onSubmit={handleTransferSubmit}
          initialCollectionId={filters.collectionId}
        />

        {confirmElement}
      </aside>

      <div
        data-no-dnd
        className={`${styles.resizer} ${isResizing ? styles.resizerActive : ''}`}
        onPointerDown={handleResizeStart}
        role="separator"
        aria-orientation="vertical"
        aria-label="Изменить ширину сайдбара"
      />

      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div className={styles.dragOverlay}>{activeDrag.name}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default forwardRef(Sidebar);