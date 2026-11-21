import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AI_CONFIG_STORAGE_KEY,
  DEFAULT_GEMINI_BASE_URL,
  DEFAULT_GEMINI_MODEL,
  clearAiConfig,
  hasConfiguredAiCredentials,
  loadAiConfig,
  saveAiConfig,
} from './aiConfig';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

describe('aiConfig persistence', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage, sessionStorage },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  });

  it('devuelve valores por defecto cuando no hay configuración guardada', () => {
    const cfg = loadAiConfig();
    expect(cfg.providerId).toBe('gemini');
    expect(cfg.apiKey).toBe('');
    expect(cfg.model).toBe(DEFAULT_GEMINI_MODEL);
    expect(cfg.baseUrl).toBe(DEFAULT_GEMINI_BASE_URL);
    expect(cfg.sessionOnly).toBe(false);
    expect(hasConfiguredAiCredentials(cfg)).toBe(false);
  });

  it('guarda en localStorage y limpia sessionStorage cuando sessionOnly es false', () => {
    saveAiConfig({
      providerId: 'gemini',
      apiKey: 'AIza-secret-local',
      model: 'gemini-2.5-pro',
      baseUrl: `${DEFAULT_GEMINI_BASE_URL}/`,
      sessionOnly: false,
    });

    expect(window.localStorage.getItem(AI_CONFIG_STORAGE_KEY)).toContain(
      'AIza-secret-local',
    );
    expect(window.sessionStorage.getItem(AI_CONFIG_STORAGE_KEY)).toBeNull();

    const loaded = loadAiConfig();
    expect(loaded.apiKey).toBe('AIza-secret-local');
    expect(loaded.model).toBe('gemini-2.5-pro');
    expect(loaded.baseUrl).toBe(DEFAULT_GEMINI_BASE_URL);
    expect(loaded.sessionOnly).toBe(false);
    expect(hasConfiguredAiCredentials(loaded)).toBe(true);
  });

  it('alterna a sessionStorage eliminando la clave previa de localStorage', () => {
    saveAiConfig({
      providerId: 'gemini',
      apiKey: 'AIza-local',
      model: 'gemini-2.5-flash',
      baseUrl: DEFAULT_GEMINI_BASE_URL,
      sessionOnly: false,
    });

    saveAiConfig({
      providerId: 'gemini',
      apiKey: 'AIza-session-only',
      model: 'gemini-2.5-flash',
      baseUrl: DEFAULT_GEMINI_BASE_URL,
      sessionOnly: true,
    });

    expect(window.localStorage.getItem(AI_CONFIG_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(AI_CONFIG_STORAGE_KEY)).toContain(
      'AIza-session-only',
    );
    expect(loadAiConfig().sessionOnly).toBe(true);

    const cleared = clearAiConfig();
    expect(cleared.apiKey).toBe('');
    expect(window.sessionStorage.getItem(AI_CONFIG_STORAGE_KEY)).toBeNull();
  });
});
