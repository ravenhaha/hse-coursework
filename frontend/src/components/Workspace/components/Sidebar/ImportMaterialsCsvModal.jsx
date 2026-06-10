import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../../Modal/Modal';

function flattenCollections(nodes, depth = 0, acc = []) {
  for (const node of nodes || []) {
    acc.push({
      id: node.id,
      name: `${'— '.repeat(depth)}${node.name}`,
    });

    if (node.children?.length) {
      flattenCollections(
        node.children.filter((child) => child.type !== 'document'),
        depth + 1,
        acc,
      );
    }
  }

  return acc;
}

export default function ImportMaterialsCsvModal({
  isOpen,
  onClose,
  collections = [],
  onSubmit,
  initialCollectionId = null,
}) {
  const options = useMemo(
    () => flattenCollections(collections),
    [collections],
  );

  const [collectionId, setCollectionId] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const fallbackId = initialCollectionId ?? options[0]?.id ?? '';
    setCollectionId(String(fallbackId));
    setFile(null);
    setError('');
    setSubmitting(false);
  }, [isOpen, initialCollectionId, options]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!collectionId) {
      setError('Выберите коллекцию');
      return;
    }

    if (!file) {
      setError('Выберите CSV-файл');
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        collectionId: Number(collectionId),
        file,
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'Не удалось импортировать CSV');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Импорт CSV">
      <form
        onSubmit={handleSubmit}
        style={{ display: 'grid', gap: 12, marginTop: 12 }}
      >
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Коллекция</span>
          <select
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
            disabled={submitting || options.length === 0}
          >
            {options.length === 0 ? (
              <option value="">Нет доступных коллекций</option>
            ) : (
              options.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))
            )}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>CSV-файл</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={submitting}
          />
        </label>

        {error ? (
          <div style={{ color: '#ff6b6b', fontSize: 13 }}>{error}</div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} disabled={submitting}>
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting || options.length === 0}
          >
            {submitting ? 'Импорт…' : 'Импортировать'}
          </button>
        </div>
      </form>
    </Modal>
  );
}