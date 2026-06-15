import { useState, useCallback, useRef } from 'react';
import ToastContainer from '../components/ToastContainer';
import { ToastContext } from './toastContextObject';

let idCounter = 0;
const nextId = () => ++idCounter;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const toastsRef = useRef(new Map()); // 🆕 актуальные данные тостов

  // Внутренняя чистка — БЕЗ onDismiss
  const cleanup = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    toastsRef.current.delete(id);
  }, []);

  // Закрытие крестиком — С onDismiss (коммит удаления)
  const dismiss = useCallback((id) => {
    const toast = toastsRef.current.get(id);
    try { toast?.onDismiss?.(); } catch (e) { console.error(e); }
    cleanup(id);
  }, [cleanup]);

  const show = useCallback((toast) => {
    const id = nextId();
    const duration = toast.duration ?? 5000;

    const newToast = {
      id,
      message: toast.message,
      type: toast.type ?? 'info',
      actionLabel: toast.actionLabel,
      onAction: toast.onAction,
      onDismiss: toast.onDismiss,
    };

    toastsRef.current.set(id, newToast); // 🆕
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      const timer = setTimeout(() => {
        const t = toastsRef.current.get(id);
        try { t?.onDismiss?.(); } catch (e) { console.error(e); }
        cleanup(id);
      }, duration);
      timersRef.current.set(id, timer);
    }

    return id;
  }, [cleanup]);

  // 🆕 Главная фикса: «Отменить» = откат БЕЗ onDismiss
  const handleAction = useCallback((id) => {
    const toast = toastsRef.current.get(id);
    try { toast?.onAction?.(); } catch (e) { console.error(e); }
    cleanup(id); // ← НЕ dismiss, иначе сработает onDismiss
  }, [cleanup]);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <ToastContainer
        toasts={toasts}
        onAction={handleAction}
        onClose={dismiss}
      />
    </ToastContext.Provider>
  );
}