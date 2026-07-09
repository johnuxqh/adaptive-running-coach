import { useCallback, useState } from 'react';
import { readStorageValue, writeStorageValue, type StorageKey } from '../utils/storage';

export function useLocalStorage<T>(key: StorageKey, initialValue: T) {
  const [value, setValue] = useState<T>(() => readStorageValue(key, initialValue));

  const setStoredValue = useCallback(
    (nextValue: T | ((currentValue: T) => T)) => {
      setValue((currentValue) => {
        const resolvedValue = nextValue instanceof Function ? nextValue(currentValue) : nextValue;
        writeStorageValue(key, resolvedValue);
        return resolvedValue;
      });
    },
    [key],
  );

  return [value, setStoredValue] as const;
}
