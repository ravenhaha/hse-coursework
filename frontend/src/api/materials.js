import JSZip from 'jszip';
import { apiFetch, ApiError } from './client';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function buildMaterialsQuery({ q = '', collectionId = null, tagIds = [] } = {}) {
  const params = new URLSearchParams();

  if (q) params.set('q', q);
  if (collectionId != null) {
    params.set('collection_id', String(collectionId));
  }

  (tagIds || []).forEach((id) => params.append('tag_ids', String(id)));

  return params.toString();
}

function getFilenameFromDisposition(disposition, fallback = 'download.bin') {
  if (!disposition) return fallback;

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const plainMatch = disposition.match(/filename="([^"]+)"/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return fallback;
}

async function fetchBinary(url, fallbackMessage, fallbackFilename) {
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });

  if (!res.ok) {
    let message = fallbackMessage;
    const contentType = res.headers.get('content-type') || '';

    try {
      if (contentType.includes('application/json')) {
        const data = await res.json();
        message = data?.detail || data?.message || message;
      } else {
        const text = await res.text();
        if (text) message = text;
      }
    } catch {
      // ignore
    }

    throw new ApiError(message, {
      status: res.status,
      code: `HTTP_${res.status}`,
    });
  }

  const blob = await res.blob();
  const filename = getFilenameFromDisposition(
    res.headers.get('content-disposition'),
    fallbackFilename,
  );

  return { blob, filename };
}

function stripExtension(filename) {
  const base = String(filename || '').split('/').pop() || 'Файл';
  return base.replace(/\.[^.]+$/, '') || base;
}

function shouldSkipArchiveEntry(entryName) {
  const normalized = String(entryName || '').replace(/\\/g, '/');
  if (!normalized) return true;
  if (normalized.endsWith('/')) return true;
  if (normalized.startsWith('__MACOSX/')) return true;

  const basename = normalized.split('/').pop() || '';
  if (basename === '.DS_Store') return true;

  return false;
}

async function importArchiveToCollection({ collectionId, file, onProgress }) {
  if (!Number.isFinite(Number(collectionId))) {
    throw new ApiError('Выберите коллекцию');
  }

  if (!(file instanceof File)) {
    throw new ApiError('Выберите ZIP-архив');
  }

  if (!String(file.name || '').toLowerCase().endsWith('.zip')) {
    throw new ApiError('Нужен файл архива .zip');
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new ApiError('Не удалось прочитать ZIP-архив');
  }

  const entries = Object.values(zip.files).filter(
    (entry) => !shouldSkipArchiveEntry(entry.name),
  );

  if (entries.length === 0) {
    throw new ApiError('В архиве нет файлов для импорта');
  }

  let createdCount = 0;
  let skippedCount = 0;
  const errors = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const filename = entry.name.split('/').pop() || `file_${index + 1}`;

    try {
      const blob = await entry.async('blob');
      const uploadFile = new File([blob], filename, {
        type: blob.type || 'application/octet-stream',
        lastModified: Date.now(),
      });

      const fd = new FormData();
      fd.append('collection_id', String(collectionId));
      fd.append('material_name', stripExtension(filename));
      fd.append('file', uploadFile);

      await apiFetch('/materials/file', {
        method: 'POST',
        body: fd,
      });

      createdCount += 1;
    } catch (err) {
      skippedCount += 1;
      errors.push({
        name: filename,
        message: err?.message || 'Не удалось загрузить файл',
      });
    } finally {
      onProgress?.({
        current: index + 1,
        total: entries.length,
        filename,
        createdCount,
        skippedCount,
      });
    }
  }

  return {
    createdCount,
    skippedCount,
    totalCount: entries.length,
    errors,
    message:
      skippedCount > 0
        ? `Импорт завершён: создано ${createdCount}, пропущено ${skippedCount}`
        : `Импорт завершён: создано ${createdCount}`,
  };
}

export const materialsApi = {
  list: (collectionId = null) => {
    const qs = collectionId != null ? `collection_id=${collectionId}` : '';
    return apiFetch(`/materials${qs ? `?${qs}` : ''}`);
  },

  get: (id) => apiFetch(`/materials/${id}`),

  search: ({ q = '', collectionId = null, tagIds = [] } = {}) => {
    const qs = buildMaterialsQuery({ q, collectionId, tagIds });
    return apiFetch(`/materials/search${qs ? `?${qs}` : ''}`);
  },

  summary: ({ q = '', collectionId = null, tagIds = [] } = {}) => {
    const qs = buildMaterialsQuery({ q, collectionId, tagIds });
    return apiFetch(`/materials/summary${qs ? `?${qs}` : ''}`);
  },

  createText: ({ collection_id, material_name, text_content }) =>
    apiFetch('/materials/text', {
      method: 'POST',
      body: { collection_id, material_name, text_content },
    }),

  createFile: ({ collection_id, material_name, file }) => {
    const fd = new FormData();
    fd.append('collection_id', String(collection_id));
    fd.append('material_name', material_name);
    fd.append('file', file);

    return apiFetch('/materials/file', {
      method: 'POST',
      body: fd,
    });
  },

  update: (id, data) =>
    apiFetch(`/materials/${id}`, {
      method: 'PATCH',
      body: data,
    }),

  delete: (id) =>
    apiFetch(`/materials/${id}`, {
      method: 'DELETE',
    }),

  fileUrl: (id) => `${API_BASE}/materials/${id}/file`,

  async getFileBlob(id) {
    const res = await fetch(`${API_BASE}/materials/${id}/file`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      throw new ApiError(`Ошибка загрузки файла (${res.status})`, {
        status: res.status,
        code: `HTTP_${res.status}`,
      });
    }

    return res.blob();
  },

  async exportCsv({ q = '', collectionId = null, tagIds = [] } = {}) {
    const qs = buildMaterialsQuery({ q, collectionId, tagIds });
    const url = `${API_BASE}/materials/export.csv${qs ? `?${qs}` : ''}`;

    return fetchBinary(
      url,
      'Не удалось экспортировать CSV',
      'materials_export.csv',
    );
  },

  async exportFilesZip(collectionId) {
    const url =
      `${API_BASE}/materials/export-files.zip` +
      `?collection_id=${encodeURIComponent(collectionId)}`;

    return fetchBinary(
      url,
      'Не удалось скачать архив',
      `collection_${collectionId}_files.zip`,
    );
  },

  importCsv({ collectionId, file }) {
    const fd = new FormData();
    fd.append('file', file);

    return apiFetch(`/materials/import.csv?collection_id=${collectionId}`, {
      method: 'POST',
      body: fd,
    });
  },

  importArchive: importArchiveToCollection,
};