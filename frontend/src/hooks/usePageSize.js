import { useState } from 'react';

const VALID_SIZES = [10, 15, 20, 30, 50, 100];
const STORAGE_PREFIX = 'attendance-admin:pageSize:';
export function usePageSize(storageKey, defaultValue = 10) {
  const [pageSize, setPageSizeState] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(STORAGE_PREFIX + storageKey));
      return VALID_SIZES.includes(stored) ? stored : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  function setPageSize(value) {
    setPageSizeState(value);
    try {
      localStorage.setItem(STORAGE_PREFIX + storageKey, String(value));
    } catch {
    }
  }

  return [pageSize, setPageSize];
}

export const PAGE_SIZE_OPTIONS = VALID_SIZES;