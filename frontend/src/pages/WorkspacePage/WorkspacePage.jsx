import { useState } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import ProfileModal from '../../components/ProfileModal/ProfileModal';
import styles from './WorkspacePage.module.css';

const mockCollections = [
  {
    id: 1,
    name: 'Проекты',
    type: 'folder',
    children: [
      { id: 11, name: 'Веб-дизайн 2025', type: 'document' },
      { id: 12, name: 'Исследования', type: 'document' },
    ],
  },
  {
    id: 2,
    name: 'Обучение',
    type: 'folder',
    children: [],
  },
];

const mockMaterials = [
  { id: 3, name: 'Личные заметки', type: 'document' },
  { id: 4, name: 'Избранное', type: 'document' },
];

export default function WorkspacePage({ user, settings, onUpdateSettings, onLogout }) {
  const [activeItemId, setActiveItemId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const stats = {
    collections: mockCollections.length,
    materials: mockMaterials.length,
  };

  return (
    <div className={styles.layout}>
      <Sidebar
        collections={mockCollections}
        materials={mockMaterials}
        user={user}
        activeItemId={activeItemId}
        onSelectItem={(id) => setActiveItemId(id)}
        onNavigateHome={() => setActiveItemId(null)}
        onCreateCollection={() => console.log('Создать коллекцию')}
        onAddMaterial={() => console.log('Добавить материал')}
        onSettings={() => setSettingsOpen(true)}
        onLogout={onLogout}
      />
      <main className={styles.content}>
        {/* Рабочая область графа */}
      </main>

      {settingsOpen && (
        <ProfileModal
          user={user}
          settings={settings}
          stats={stats}
          onClose={() => setSettingsOpen(false)}
          onUpdateSettings={onUpdateSettings}
          onLogout={onLogout}
          onDeleteAccount={() => console.log('Удалить аккаунт')}
          onExportData={() => console.log('Экспорт данных')}
        />
      )}
    </div>
  );
}
