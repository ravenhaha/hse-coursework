import { useState, useCallback, useRef } from 'react';
import ConfirmModal from '../components/Workspace/components/Sidebar/ConfirmModal';

/**
 * Императивный confirm-хук.
 *
 * Использование:
 *   const { confirm, confirmElement } = useConfirm();
 *   const ok = await confirm({ title: 'Удалить?', danger: true });
 *   if (ok) { ... }
 *
 *   // В JSX:
 *   {confirmElement}
 */
export default function useConfirm() {
  const [state, setState] = useState({ isOpen: false, props: {} });
  const resolverRef = useRef(null);

  const confirm = useCallback((props) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({ isOpen: true, props });
    });
  }, []);

  const handleClose = useCallback((result) => {
    setState((prev) => ({ ...prev, isOpen: false }));
    resolverRef.current?.(result);
    resolverRef.current = null;
  }, []);

  const confirmElement = (
    <ConfirmModal
      isOpen={state.isOpen}
      title={state.props.title}
      message={state.props.message}
      confirmLabel={state.props.confirmLabel}
      cancelLabel={state.props.cancelLabel}
      danger={state.props.danger}
      onConfirm={() => handleClose(true)}
      onCancel={() => handleClose(false)}
    />
  );

  return { confirm, confirmElement };
}