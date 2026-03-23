import { useState } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Workspace from '../../components/Workspace/Workspace.jsx';
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

const mockUser = {
  name: 'Анна Иванова',
  email: 'anna@example.com',
};

export default function WorkspacePage() {
  const [activeItemId, setActiveItemId] = useState(null);

  return (
    <div className={styles.layout}>
      <Sidebar
        collections={mockCollections}
        materials={mockMaterials}
        user={mockUser}
        activeItemId={activeItemId}
        onSelectItem={(id) => setActiveItemId(id)}
        onNavigateHome={() => setActiveItemId(null)}
        onCreateCollection={() => console.log('Создать коллекцию')}
        onAddMaterial={() => console.log('Добавить материал')}
        onSettings={() => console.log('Настройки')}
        onLogout={() => console.log('Выход')}
      />
      <main className={styles.content}>
        <Workspace />
      </main>
    </div>
  );
}