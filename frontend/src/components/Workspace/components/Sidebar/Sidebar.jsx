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

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 500;
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_WIDTH_KEY = 'sidebarWidth';

const isFiltersEmpty = (f) =>
  f.collectionId == null &&
  (f.tagIds?.length ?? 0) === 0 &&
  !f.onlyImportant &&
  !f.kind &&
  !f.dateFrom &&
  !f.dateTo;

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

function collectAllFolderIds(nodes = [], acc = {}) {
  for (const node of nodes) {
    if (node?.type === 'document') continue;
    acc[node.id] = true;

    if (node.children?.length) {
      collectAllFolderIds(
        node.children.filter((child) => child.type !== 'document'),
        acc,
      );
    }
  }

  return acc;
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
}) {
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
  },
  ref,
) {
  const [expandedFolders, setExpandedFolders] = useState({});
  const [ctxMenu, setCtxMenu] = useState(null);
  const [renamingKey, setRenamingKey] = useState(null);
  const [addModal, setAddModal] = useState({ open: false, parentId: null });
  const [creatingInFolderId, setCreatingInFolderId] = useState(null);
  const [externalCreateTick, setExternalCreateTick] = useState(0);

  const { confirm, confirmElement } = useConfirm();
  const { show: showToast } = useToast();

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

  const searchExpandedFolders = useMemo(
    () => collectAllFolderIds(pureCollections),
    [pureCollections],
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
          isDescendant(pureCollections, itemIdNum, targetParentIdNum)
        ) {
          return;
        }

        const currentParent = findCollectionParent(pureCollections, itemIdNum);
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
    [pureCollections, onMoveItem, showToast],
  );

  const handleDragCancel = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    hoverFolderRef.current = null;
    setActiveDrag(null);
  }, []);

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
        expandedFolders={search ? searchExpandedFolders : expandedFolders}
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