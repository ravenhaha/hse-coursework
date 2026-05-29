import { useState, useEffect } from 'react';
import {
  IoClose,
  IoSettingsOutline,
  IoPersonOutline,
  IoServerOutline,
  IoInformationCircleOutline,
  IoFolderOpenOutline,
  IoDocumentTextOutline,
  IoCloudDownloadOutline,
  IoLogOutOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import styles from './ProfileModal.module.css';

import { useAvatarUpload } from '../../hooks/useAvatarUpload';
import { getAvatarUrl } from '../../utils/avatar';
import AvatarEditor from '../AvatarEditor';
import EditableField from '../ProfileModal/EditableField';

import { usersApi } from '../../api/users';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';        // 🆕
import useConfirm from '../../hooks/useConfirm';          // 🆕

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
  onDeleteAccount,        // 🆕 из WorkspacePage
}) {
  const [activeTab, setActiveTab] = useState('general');

  // 🆕 Esc → закрыть + блокировка скролла страницы под модалкой
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
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
            {activeTab === 'data' && <DataTab stats={stats} />}
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

      {/* 🆕 Уведомления — пока нет бэка, честно дисейблим */}
      <div className={`${styles.row} ${styles.rowDisabled}`}>
        <span className={styles.rowLabel}>
          Уведомления <span className={styles.soonBadge}>Скоро</span>
        </span>
        <label className={styles.toggle} title="Эта функция появится в следующих обновлениях">
          <input
            type="checkbox"
            checked={false}
            disabled
            readOnly
          />
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
  const { show } = useToast();                  // 🆕
  const { confirm, confirmElement } = useConfirm();  // 🆕

  const avatarUrl = getAvatarUrl(user);
  const initial = (user?.name || '?').trim().charAt(0).toUpperCase();

  // 🆕 Сохранение имени с тостом
  const handleSaveName = async (newName) => {
    try {
      await usersApi.updateProfile({ display_name: newName });
      await refreshUser();
      show({ type: 'success', message: 'Имя сохранено' });
    } catch (err) {
      show({
        type: 'error',
        message: err?.message || 'Не удалось сохранить имя',
      });
      throw err; // пробрасываем, чтобы EditableField остался в edit-режиме
    }
  };

  // 🆕 Подтверждение загрузки + тост на успех/провал
  const handleConfirmCrop = async (file) => {
    try {
      await confirmCrop(file);
      show({ type: 'success', message: 'Аватар обновлён' });
    } catch (err) {
      show({
        type: 'error',
        message: err?.message || 'Не удалось загрузить аватар',
      });
    }
  };

  // 🆕 Удаление аватара — confirm + тост
  const handleRemoveAvatar = async () => {
    const ok = await confirm({
      title: 'Удалить аватар?',
      message: 'Аватар будет удалён. Восстановить нельзя — вы сможете загрузить новый.',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;

    try {
      await removeAvatar();
      show({ type: 'success', message: 'Аватар удалён' });
    } catch (err) {
      show({
        type: 'error',
        message: err?.message || 'Не удалось удалить аватар',
      });
    }
  };

  // 🆕 Logout — confirm
  const handleLogoutClick = async () => {
    const ok = await confirm({
      title: 'Выйти из аккаунта?',
      message: 'Вы вернётесь к экрану входа. Все несохранённые данные останутся в браузере.',
      confirmLabel: 'Выйти',
      cancelLabel: 'Остаться',
      danger: false,
    });
    if (!ok) return;
    onLogout?.();
  };

  return (
    <>
      {/* ===== Аватар ===== */}
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
            className={styles.outlineButton}
            onClick={pickFile}
            disabled={busy}
          >
            {busy ? 'Загружаем…' : (avatarUrl ? 'Заменить' : 'Загрузить аватар')}
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

      {/* ===== Имя ===== */}
      <div className={styles.row}>
        <span className={styles.rowLabel}>Имя</span>
        <EditableField
          value={user?.name || ''}
          onSave={handleSaveName}
          placeholder="—"
          maxLength={100}
        />
      </div>

      {/* ===== Email ===== */}
      <div className={styles.row}>
        <span className={styles.rowLabel}>Email</span>
        <span className={styles.rowValue} title={user?.email}>
          {maskEmail(user?.email)}
        </span>
      </div>

      {/* ===== Опасная зона ===== */}
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

      {/* ===== Модалка обрезки ===== */}
      {previewSrc && (
        <AvatarEditor
          src={previewSrc}
          busy={busy}
          onCancel={cancelCrop}
          onConfirm={handleConfirmCrop}
        />
      )}

      {/* 🆕 Confirm-модалки */}
      {confirmElement}
    </>
  );
}

/* ═════════════════════════ ВКЛАДКА: ДАННЫЕ ═════════════════════════ */
function DataTab({ stats }) {
  return (
    <>
      {/* 🆕 Статистика — карточки */}
      <div className={styles.statGrid}>
        <div className={styles.statCard}>
          <IoFolderOpenOutline className={styles.statIcon} />
          <div className={styles.statValue}>{stats?.collections ?? 0}</div>
          <div className={styles.statLabel}>Коллекций</div>
        </div>
        <div className={styles.statCard}>
          <IoDocumentTextOutline className={styles.statIcon} />
          <div className={styles.statValue}>{stats?.materials ?? 0}</div>
          <div className={styles.statLabel}>Материалов</div>
        </div>
      </div>

      <div className={`${styles.row} ${styles.rowDisabled}`}>
        <span className={styles.rowLabel}>
          <IoCloudDownloadOutline style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Экспорт данных
          <span className={styles.soonBadge}>Скоро</span>
        </span>
        <button
          className={styles.outlineButton}
          disabled
          title="Эта функция появится в следующих обновлениях"
        >
          Скоро
        </button>
      </div>
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
        <div className={styles.aboutTagline}>
          Ваша персональная база знаний
        </div>
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