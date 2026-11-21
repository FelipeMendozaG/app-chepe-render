export type AiProviderId = 'gemini';

export interface AiProviderConfig {
  providerId: AiProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
  sessionOnly: boolean;
}

export const AI_CONFIG_STORAGE_KEY = 'chepita.ai.config.v1';

export const DEFAULT_GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export const GEMINI_MODEL_SUGGESTIONS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
] as const;

export function createDefaultAiConfig(): AiProviderConfig {
  return {
    providerId: 'gemini',
    apiKey: '',
    model: DEFAULT_GEMINI_MODEL,
    baseUrl: DEFAULT_GEMINI_BASE_URL,
    sessionOnly: false,
  };
}

export function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  return trimmed || DEFAULT_GEMINI_BASE_URL;
}

function parseStoredConfig(
  raw: string | null,
  sessionOnly: boolean,
): AiProviderConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AiProviderConfig>;
    if (!parsed || typeof parsed !== 'object') return null;
    const providerId: AiProviderId =
      parsed.providerId === 'gemini' ? 'gemini' : 'gemini';
    const apiKey = typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '';
    const model =
      typeof parsed.model === 'string' && parsed.model.trim()
        ? parsed.model.trim()
        : DEFAULT_GEMINI_MODEL;
    const baseUrl = normalizeBaseUrl(
      typeof parsed.baseUrl === 'string' ? parsed.baseUrl : DEFAULT_GEMINI_BASE_URL,
    );
    return {
      providerId,
      apiKey,
      model,
      baseUrl,
      sessionOnly,
    };
  } catch {
    return null;
  }
}

function getStorageSafe(kind: 'local' | 'session'): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Loads AI configuration from sessionStorage first (when session-only mode is used),
 * falling back to localStorage. Never reads from or writes to project documents.
 */
export function loadAiConfig(): AiProviderConfig {
  const session = getStorageSafe('session');
  const fromSession = parseStoredConfig(
    session?.getItem(AI_CONFIG_STORAGE_KEY) ?? null,
    true,
  );
  if (fromSession) {
    return fromSession;
  }

  const local = getStorageSafe('local');
  const fromLocal = parseStoredConfig(
    local?.getItem(AI_CONFIG_STORAGE_KEY) ?? null,
    false,
  );
  if (fromLocal) {
    return fromLocal;
  }

  return createDefaultAiConfig();
}

export function saveAiConfig(config: AiProviderConfig): AiProviderConfig {
  const normalized: AiProviderConfig = {
    providerId: config.providerId,
    apiKey: config.apiKey.trim(),
    model: config.model.trim() || DEFAULT_GEMINI_MODEL,
    baseUrl: normalizeBaseUrl(config.baseUrl),
    sessionOnly: Boolean(config.sessionOnly),
  };

  const payload = JSON.stringify(normalized);
  const local = getStorageSafe('local');
  const session = getStorageSafe('session');

  if (normalized.sessionOnly) {
    session?.setItem(AI_CONFIG_STORAGE_KEY, payload);
    local?.removeItem(AI_CONFIG_STORAGE_KEY);
  } else {
    local?.setItem(AI_CONFIG_STORAGE_KEY, payload);
    session?.removeItem(AI_CONFIG_STORAGE_KEY);
  }

  return normalized;
}

export function clearAiConfig(): AiProviderConfig {
  getStorageSafe('local')?.removeItem(AI_CONFIG_STORAGE_KEY);
  getStorageSafe('session')?.removeItem(AI_CONFIG_STORAGE_KEY);
  return createDefaultAiConfig();
}

export function hasConfiguredAiCredentials(config: AiProviderConfig): boolean {
  return config.apiKey.trim().length > 0 && config.model.trim().length > 0;
}
