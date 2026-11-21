import { normalizeBaseUrl, type AiProviderConfig } from '../../persistence';
import { buildSystemInstruction, buildTurnPrompt } from '../promptBuilder';
import type {
  AIProviderAdapter,
  AiConnectionTestResult,
  AiPlanRequest,
  AiRawPlanResponse,
} from '../types';

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

function buildGenerateContentUrl(config: AiProviderConfig): string {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const model = encodeURIComponent(config.model.trim());
  return `${baseUrl}/v1beta/models/${model}:generateContent`;
}

function mapHttpError(status: number, apiMessage?: string): string {
  if (status === 400) {
    return apiMessage
      ? `Solicitud rechazada por Gemini (400): ${apiMessage}`
      : 'Solicitud inválida (400). Revisa el nombre del modelo y los parámetros.';
  }
  if (status === 401 || status === 403) {
    return 'Clave de API inválida o sin permisos (401/403). Verifica tu API Key de Gemini.';
  }
  if (status === 404) {
    return 'Modelo o endpoint no encontrado (404). Comprueba el identificador del modelo y la URL base.';
  }
  if (status === 429) {
    return 'Límite de solicitudes o cuota excedida (429). Intenta de nuevo en unos momentos.';
  }
  if (status >= 500) {
    return `El servicio de Gemini devolvió un error interno (${status}). Intenta de nuevo más tarde.`;
  }
  return apiMessage
    ? `Error de Gemini (${status}): ${apiMessage}`
    : `Error HTTP inesperado (${status}) al conectar con Gemini.`;
}

function extractTextFromGeminiResponse(payload: GeminiApiResponse): string | null {
  const parts = payload.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();
  return text.length > 0 ? text : null;
}

export class GeminiAdapter implements AIProviderAdapter {
  readonly providerId = 'gemini';

  async testConnection(
    config: AiProviderConfig,
    signal?: AbortSignal,
  ): Promise<AiConnectionTestResult> {
    if (!config.apiKey.trim()) {
      return {
        ok: false,
        message: 'Ingresa tu API Key de Gemini antes de probar la conexión.',
      };
    }
    if (!config.model.trim()) {
      return {
        ok: false,
        message: 'Ingresa un identificador de modelo válido (ej. gemini-2.5-flash).',
      };
    }

    const startedAt = Date.now();
    const url = buildGenerateContentUrl(config);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.apiKey.trim(),
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: 'Responde únicamente con el JSON exacto {"ok":true}.',
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0,
            maxOutputTokens: 32,
          },
        }),
        signal,
      });

      const data = (await response.json().catch(() => ({}))) as GeminiApiResponse;

      if (!response.ok) {
        return {
          ok: false,
          message: mapHttpError(response.status, data.error?.message),
        };
      }

      const rawText = extractTextFromGeminiResponse(data);
      if (!rawText) {
        return {
          ok: false,
          message:
            'El modelo respondió sin contenido. Verifica si el modelo soporta generación de texto JSON.',
        };
      }

      try {
        JSON.parse(rawText);
      } catch {
        return {
          ok: false,
          message:
            'El modelo respondió pero no devolvió JSON válido. Prueba con otro modelo como gemini-2.5-flash.',
        };
      }

      return {
        ok: true,
        message: `Conexión verificada con ${config.model.trim()}.`,
        latencyMs: Date.now() - startedAt,
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, message: 'Prueba de conexión cancelada.' };
      }
      return {
        ok: false,
        message:
          'No se pudo conectar con el servidor de Gemini. Verifica tu conexión a internet o la URL base.',
      };
    }
  }

  async generatePlan(
    config: AiProviderConfig,
    request: AiPlanRequest,
  ): Promise<AiRawPlanResponse> {
    if (!config.apiKey.trim()) {
      return {
        ok: false,
        error: 'Configura tu API Key de Gemini antes de usar el asistente.',
      };
    }

    const url = buildGenerateContentUrl(config);
    const systemInstruction = buildSystemInstruction();
    const turnPrompt = buildTurnPrompt(
      request.userPrompt,
      request.document,
      request.selectedId,
      request.recentHistory,
    );

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.apiKey.trim(),
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: turnPrompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
        signal: request.signal,
      });

      const data = (await response.json().catch(() => ({}))) as GeminiApiResponse;

      if (!response.ok) {
        return {
          ok: false,
          error: mapHttpError(response.status, data.error?.message),
        };
      }

      const rawText = extractTextFromGeminiResponse(data);
      if (!rawText) {
        return {
          ok: false,
          error:
            'Gemini no devolvió contenido en su respuesta. Reformula tu solicitud e inténtalo de nuevo.',
        };
      }

      return { ok: true, rawText };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, error: 'Solicitud cancelada.' };
      }
      return {
        ok: false,
        error:
          'No se pudo comunicar con Gemini. Verifica tu conexión a internet y vuelve a intentarlo.',
      };
    }
  }
}
