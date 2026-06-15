// src/utils/materialType.js
import {
  IoImageOutline,
  IoDocumentOutline,
  IoDocumentTextOutline,
  IoMusicalNotesOutline,
  IoVideocamOutline,
  IoCreateOutline,
} from 'react-icons/io5';

/**
 * Определяет тип материала по данным из БД.
 *  1) source_type === 'text'  → 'note'
 *  2) source_type === 'file'  → расширение из file_path
 *
 * Расширение берём из file_path (а не из material_name),
 * т.к. material_name юзер может переименовать.
 */
export function getMaterialType(material) {
  if (!material) return 'document';
  const data = material.raw || material;

  if (data.source_type === 'text') return 'note';

  const path = data.file_path || '';
  const ext = path.split('.').pop().toLowerCase();

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) return 'audio';
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) return 'video';

  return 'document';
}

const TYPE_CONFIG = {
  image:    { Icon: IoImageOutline,         color: '#22c55e' }, // зелёный
  pdf:      { Icon: IoDocumentOutline,      color: '#ef4444' }, // красный
  audio:    { Icon: IoMusicalNotesOutline,  color: '#a855f7' }, // фиолетовый
  video:    { Icon: IoVideocamOutline,      color: '#3b82f6' }, // синий
  note:     { Icon: IoCreateOutline,        color: '#eab308' }, // жёлтый
  document: { Icon: IoDocumentTextOutline,  color: '#9ca3af' }, // серый
};

export function getMaterialIconConfig(type) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.document;
}

export function getMaterialIcon(material) {
  return getMaterialIconConfig(getMaterialType(material));
}