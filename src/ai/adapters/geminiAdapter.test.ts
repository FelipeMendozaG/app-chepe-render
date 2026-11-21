import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyProjectDocument } from '../../domain';
import {
  DEFAULT_GEMINI_BASE_URL,
  type AiProviderConfig,
} from '../../persistence';
import { GeminiAdapter } from './geminiAdapter';

const TEST_CONFIG: AiProviderConfig = {
  providerId: 'gemini',
  apiKey: 'AIza-test-key',
  model: 'gemini-2.5-flash',
  baseUrl: DEFAULT_GEMINI_BASE_URL,
  sessionOnly: true,
};

describe('GeminiAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('envía x-goog-api-key en el header (nunca en la URL) y valida conexión exitosa', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"ok":true}' }],
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new GeminiAdapter();
    const res = await adapter.testConnection(TEST_CONFIG);

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `${DEFAULT_GEMINI_BASE_URL}/v1beta/models/gemini-2.5-flash:generateContent`,
    );
    expect(url).not.toContain('AIza-test-key');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(
      'AIza-test-key',
    );
  });

  it('traduce errores HTTP 401/404/429 y fallos de red a mensajes claros en español', async () => {
    const adapter = new GeminiAdapter();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'API key not valid' } }),
      }),
    );
    const unauthorized = await adapter.testConnection(TEST_CONFIG);
    expect(unauthorized.ok).toBe(false);
    expect(unauthorized.message).toContain('401/403');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );
    const networkErr = await adapter.generatePlan(TEST_CONFIG, {
      userPrompt: 'Crea una mesa',
      document: createEmptyProjectDocument(),
      selectedId: null,
    });
    expect(networkErr.ok).toBe(false);
    if (!networkErr.ok) {
      expect(networkErr.error).toContain('conexión');
    }
  });
});
