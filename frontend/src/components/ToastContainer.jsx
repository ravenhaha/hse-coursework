import { createPortal } from 'react-dom';
import Toast from './Toast';

export default function ToastContainer({ toasts, onAction, onClose }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <Toast toast={toast} onAction={onAction} onClose={onClose} />
        </div>
      ))}
    </div>,
    document.body
  );
}