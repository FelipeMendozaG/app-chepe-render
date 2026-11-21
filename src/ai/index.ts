import type { AiProviderId } from '../persistence';
import { GeminiAdapter } from './adapters/geminiAdapter';
import type { AIProviderAdapter } from './types';

export * from './types';
export * from './sceneContext';
export * from './promptBuilder';
export * from './planValidator';
export * from './commandExecutor';
export { GeminiAdapter } from './adapters/geminiAdapter';

const ADAPTERS: Record<AiProviderId, AIProviderAdapter> = {
  gemini: new GeminiAdapter(),
};

export function getAiProviderAdapter(
  providerId: AiProviderId,
): AIProviderAdapter {
  return ADAPTERS[providerId];
}
