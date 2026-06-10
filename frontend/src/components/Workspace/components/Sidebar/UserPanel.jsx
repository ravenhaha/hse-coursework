import { useMemo, useState } from 'react';
import { IoSettingsOutline, IoLogOutOutline } from 'react-icons/io5';
import styles from './Sidebar.module.css';

function extractAssetString(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'object') {
    const nested =
      value.url ||
      value.src ||
      value.path ||
      value.href ||
      value.file_url ||
      value.fileUrl ||
      value.public_url ||
      value.publicUrl ||
      '';

    return typeof nested === 'string' ? nested.trim() : '';
  }

  return '';
}

function normalizeAssetUrl(rawUrl) {
  const value = String(rawUrl || '').trim();

  if (!value) return '';

  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('//') ||
    value.startsWith('blob:') ||
    value.startsWith('data:')
  ) {
    return value;
  }

  if (value.startsWith('/')) {
    return value;
  }

  return `/${value.replace(/^\.?\//, '')}`;
}

function getAvatarUrl(user) {
  const candidates = [
    user?.avatarUrl,
    user?.avatar_url,
    user?.avatar,
    user?.photoUrl,
    user?.photo_url,
    user?.photo,
    user?.imageUrl,
    user?.image_url,
    user?.image,
    user?.pictureUrl,
    user?.picture_url,
    user?.picture,
    user?.profileImage,
    user?.profile_image,
    user?.profilePicture,
    user?.profile_picture,

    user?.profile?.avatarUrl,
    user?.profile?.avatar_url,
    user?.profile?.avatar,
    user?.profile?.photoUrl,
    user?.profile?.photo_url,
    user?.profile?.photo,
    user?.profile?.imageUrl,
    user?.profile?.image_url,
    user?.profile?.image,
    user?.profile?.pictureUrl,
    user?.profile?.picture_url,
    user?.profile?.picture,

    user?.raw?.avatarUrl,
    user?.raw?.avatar_url,
    user?.raw?.avatar,
    user?.raw?.photoUrl,
    user?.raw?.photo_url,
    user?.raw?.photo,
    user?.raw?.imageUrl,
    user?.raw?.image_url,
    user?.raw?.image,
  ];

  for (const candidate of candidates) {
    const extracted = extractAssetString(candidate);
    if (extracted) {
      return normalizeAssetUrl(extracted);
    }
  }

  return '';
}

function getDisplayName(user) {
  return (
    user?.name ||
    user?.full_name ||
    user?.fullName ||
    user?.username ||
    user?.login ||
    user?.email?.split('@')[0] ||
    user?.profile?.name ||
    user?.profile?.username ||
    'Пользователь'
  );
}

function getInitials(value) {
  const text = String(value || '').trim();

  if (!text) return 'U';

  const parts = text.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }

  return text.slice(0, 2).toUpperCase();
}

function AvatarContent({ avatarUrl, displayName, initials }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!avatarUrl || imageFailed) {
    return initials;
  }

  return (
    <img
      src={avatarUrl}
      alt={displayName}
      className={styles.avatarImg}
      onError={() => setImageFailed(true)}
    />
  );
}

export default function UserPanel({ user = null, onSettings, onLogout }) {
  const avatarUrl = useMemo(() => getAvatarUrl(user), [user]);
  const displayName = useMemo(() => getDisplayName(user), [user]);
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  return (
    <div className={styles.userSection}>
      <div className={styles.userInfo}>
        <div className={styles.avatar}>
          <AvatarContent
            key={avatarUrl || 'empty-avatar'}
            avatarUrl={avatarUrl}
            displayName={displayName}
            initials={initials}
          />
        </div>

        <div className={styles.userText}>
          <div className={styles.userName} title={displayName}>
            {displayName}
          </div>
        </div>
      </div>

      <div className={styles.userActions}>
        <button
          type="button"
          className={styles.settingsButton}
          onClick={() => onSettings?.()}
        >
          <IoSettingsOutline />
          <span>Настройки</span>
        </button>

        <button
          type="button"
          className={styles.logoutButton}
          onClick={() => onLogout?.()}
          aria-label="Выйти"
          title="Выйти"
        >
          <IoLogOutOutline />
        </button>
      </div>
    </div>
  );
}