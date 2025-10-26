'use client';

import { useCallback, useEffect, useState } from 'react';

type Serializer<T> = (value: T) => string;
type Deserializer<T> = (value: string) => T;

interface UseLocalStorageOptions<T> {
  readonly serializer?: Serializer<T>;
  readonly deserializer?: Deserializer<T>;
}

function defaultSerializer<T>(value: T): string {
  return JSON.stringify(value);
}

function defaultDeserializer<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: UseLocalStorageOptions<T>
): readonly [T, (value: T | ((prev: T) => T)) => void] {
  const serializer = options?.serializer ?? defaultSerializer<T>;
  const deserializer = options?.deserializer ?? defaultDeserializer<T>;
  const isBrowser = typeof window !== 'undefined';

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (!isBrowser) {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item === null) {
        return initialValue;
      }
      return deserializer(item);
    } catch (error) {
      console.warn(`Erro ao ler localStorage para "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setStoredValue(deserializer(item));
      }
    } catch (error) {
      console.warn(`Erro ao sincronizar localStorage para "${key}":`, error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue(prev => {
        const newValue = value instanceof Function ? value(prev) : value;

        if (isBrowser) {
          try {
            window.localStorage.setItem(key, serializer(newValue));
          } catch (error) {
            console.warn(`Erro ao gravar localStorage para "${key}":`, error);
          }
        }

        return newValue;
      });
    },
    [isBrowser, key, serializer]
  );

  return [storedValue, setValue] as const;
}
