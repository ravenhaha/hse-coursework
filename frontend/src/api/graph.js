import { apiFetch } from './client';

export const graphApi = {
  tree: () => apiFetch('/graph/tree'),
};
