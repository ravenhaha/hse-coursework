import { useEffect, useState } from 'react';
import { IoCloudOfflineOutline, IoCheckmarkCircle } from 'react-icons/io5';
import { setNetworkErrorHandler } from '../../api/client';
import styles from './NetworkStatusBanner.module.css';

/**
 * Глобальный баннер сетевого статуса.
 *
 * Логика:
 *   - Слушает window 'online'/'offline' (мгновенно реагирует на потерю Wi-Fi)
 *   - Слушает наш кастомный сигнал onNetworkError (когда fetch упал из-за CORS/DNS/etc)
 *   - Когда соединение восстанавливается — на 2 секунды показывает зелёную плашку,
 *     потом сам прячется.
 */
function NetworkStatusBanner() {
  // 'online' | 'offline' | 'recovered'
  const [status, setStatus] = useState(
    navigator.onLine ? 'online' : 'offline'
  );

  useEffect(() => {
    const handleOffline = () => setStatus('offline');

    const handleOnline = () => {
      // Покажем зелёный "Связь восстановлена" на 2 сек, потом скроем
      setStatus('recovered');
      setTimeout(() => {
        // Проверяем актуальное состояние сети на момент таймаута
        if (navigator.onLine) setStatus('online');
      }, 2000);
    };

    // Сигнал от apiFetch: fetch упал → считаем что offline
    setNetworkErrorHandler(() => {
      if (navigator.onLine) {
        // Wi-Fi есть, но запрос не дошёл (сервер/CORS/DNS).
        // Всё равно показываем offline — для юзера разницы нет.
        setStatus('offline');
      }
    });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      setNetworkErrorHandler(null);
    };
  }, []);

  if (status === 'online') return null;

  const isRecovered = status === 'recovered';

  return (
    <div
      className={`${styles.banner} ${isRecovered ? styles.recovered : styles.offline}`}
      role="status"
      aria-live="polite"
    >
      {isRecovered ? (
        <>
          <IoCheckmarkCircle className={styles.icon} aria-hidden="true" />
          <span>Связь восстановлена</span>
        </>
      ) : (
        <>
          <IoCloudOfflineOutline className={styles.icon} aria-hidden="true" />
          <span>Нет связи с сервером. Проверьте интернет-соединение.</span>
        </>
      )}
    </div>
  );
}

export default NetworkStatusBanner;