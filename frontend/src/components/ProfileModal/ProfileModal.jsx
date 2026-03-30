import { useState } from 'react';
import {
  IoClose,
  IoSettingsOutline,
  IoPersonOutline,
  IoServerOutline,
  IoInformationCircleOutline,
} from 'react-icons/io5';
import styles from './ProfileModal.module.css';

const tabs = [
  { id: 'general', label: 'Общие', icon: IoSettingsOutline },
  { id: 'profile', label: 'Профиль', icon: IoPersonOutline },
  { id: 'data', label: 'Данные', icon: IoServerOutline },
  { id: 'about', label: 'О приложении', icon: IoInformationCircleOutline },
];

function maskEmail(email) {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (local.length <= 3) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 3)}${'*'.repeat(local.length - 3)}@${domain}`;
}

export default function ProfileModal({
  user,
  settings,
  stats,
  onClose,
  onUpdateSettings,
  onLogout,
  onDeleteAccount,
  onExportData,
}) {
  const [activeTab, setActiveTab] = useState('general');

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={onClose}>
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
                  className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabButtonActive : ''}`}
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
              <DataTab stats={stats} onExportData={onExportData} />
            )}
            {activeTab === 'about' && <AboutTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function GeneralTab({ settings, onUpdateSettings }) {
  const handleChange = (key, value) => {
    onUpdateSettings?.({ ...settings, [key]: value });
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
          <option value="light" disabled>Светлая (скоро)</option>
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
          <option value="en" disabled>English (скоро)</option>
        </select>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Уведомления</span>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={settings?.notifications || false}
            onChange={(e) => handleChange('notifications', e.target.checked)}
          />
          <span className={styles.toggleSlider} />
        </label>
      </div>
    </>
  );
}

function ProfileTab({ user, onLogout, onDeleteAccount }) {
  return (
    <>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Имя</span>
        <span className={styles.rowValue}>{user?.name || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Email</span>
        <span className={styles.rowValue}>{maskEmail(user?.email)}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Телефон</span>
        <span className={styles.rowValue}>—</span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Выйти со всех устройств</span>
        <button className={styles.dangerButton} onClick={() => onLogout?.()}>
          Выйти
        </button>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Удалить аккаунт</span>
        <button className={styles.dangerButton} onClick={() => onDeleteAccount?.()}>
          Удалить
        </button>
      </div>
    </>
  );
}

function DataTab({ stats, onExportData }) {
  return (
    <>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Коллекции</span>
        <span className={styles.rowValue}>{stats?.collections ?? 0}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Материалы</span>
        <span className={styles.rowValue}>{stats?.materials ?? 0}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Экспорт данных</span>
        <button className={styles.outlineButton} onClick={() => onExportData?.()}>
          Скачать
        </button>
      </div>
    </>
  );
}

function AboutTab() {
  return (
    <>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Приложение</span>
        <span className={styles.rowValue}>Омут памяти</span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Версия</span>
        <span className={styles.rowValue}>0.1.0</span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Разработчики</span>
        <span className={styles.rowValue}>Команда HSE</span>
      </div>
    </>
  );
}
