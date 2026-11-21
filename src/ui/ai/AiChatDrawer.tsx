import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  executeAiPlan,
  getAiProviderAdapter,
  parseAndValidateAiPlan,
  type AiProposedPlan,
} from '../../ai';
import { generateId, type AiChatMessage } from '../../domain';
import {
  hasConfiguredAiCredentials,
  type AiProviderConfig,
} from '../../persistence';
import { useProjectStore } from '../../store';
import styles from './AiChatDrawer.module.css';

interface AiChatDrawerProps {
  open: boolean;
  config: AiProviderConfig;
  onClose: () => void;
  onOpenSettings: () => void;
  onNotify?: (message: string) => void;
}

const EMPTY_CHAT_HISTORY: readonly AiChatMessage[] = [];

const EXAMPLE_PROMPTS = [
  'Crea una mesa de 140 × 70 × 75 cm con cubierta de roble y 4 patas metálicas agrupadas como Base',
  'Arma una estantería de 4 niveles de 80 × 30 × 160 cm en madera clara',
  'Duplica la pieza seleccionada y muévela 50 cm hacia la derecha',
];

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

export function AiChatDrawer({
  open,
  config,
  onClose,
  onOpenSettings,
  onNotify,
}: AiChatDrawerProps) {
  const projectId = useProjectStore((s) => s.document.project.id);
  const chatHistory = useProjectStore(
    (s) => s.document.aiChatHistory ?? EMPTY_CHAT_HISTORY,
  );
  const appendAiChatMessage = useProjectStore((s) => s.appendAiChatMessage);
  const updateAiChatPlanStatus = useProjectStore(
    (s) => s.updateAiChatPlanStatus,
  );
  const clearAiChatHistory = useProjectStore((s) => s.clearAiChatHistory);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingPlans, setPendingPlans] = useState<
    Record<string, AiProposedPlan>
  >({});

  const listEndRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isConfigured = hasConfiguredAiCredentials(config);

  // Reset in-memory executable plans when switching projects
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSending(false);
    setPendingPlans({});
  }, [projectId]);

  useEffect(() => {
    if (open) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, chatHistory.length, sending]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  if (!open) {
    return null;
  }

  const handleSend = async (promptOverride?: string) => {
    const promptText = (promptOverride ?? draft).trim();
    if (!promptText || sending || !isConfigured) return;

    const userMsgId = generateId('msg');
    const nowIso = new Date().toISOString();
    const stateBefore = useProjectStore.getState();

    appendAiChatMessage({
      id: userMsgId,
      role: 'user',
      text: promptText,
      createdAt: nowIso,
    });
    if (promptOverride === undefined) {
      setDraft('');
    }

    setSending(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const adapter = getAiProviderAdapter(config.providerId);
    const rawResponse = await adapter.generatePlan(config, {
      userPrompt: promptText,
      document: stateBefore.document,
      selectedId: stateBefore.selectedId,
      recentHistory: stateBefore.document.aiChatHistory,
      signal: controller.signal,
    });

    setSending(false);
    abortRef.current = null;

    const assistantMsgId = generateId('msg');
    const responseIso = new Date().toISOString();

    if (!rawResponse.ok) {
      appendAiChatMessage({
        id: assistantMsgId,
        role: 'assistant',
        text: rawResponse.error,
        createdAt: responseIso,
        plan: {
          summary: 'No se pudo obtener un plan de Gemini',
          items: [],
          status: 'error',
          errorMessage: rawResponse.error,
        },
      });
      return;
    }

    const latestDoc = useProjectStore.getState().document;
    const validation = parseAndValidateAiPlan(rawResponse.rawText, latestDoc);

    if (!validation.ok) {
      const errorText = validation.errors.join(' ');
      appendAiChatMessage({
        id: assistantMsgId,
        role: 'assistant',
        text: 'El modelo devolvió una propuesta que no cumple las reglas del dominio. Reformula tu solicitud e inténtalo de nuevo.',
        createdAt: responseIso,
        plan: {
          summary: 'Propuesta rechazada por validación',
          items: validation.errors,
          status: 'error',
          errorMessage: errorText,
        },
      });
      return;
    }

    const { plan } = validation;

    if (plan.commands.length === 0) {
      appendAiChatMessage({
        id: assistantMsgId,
        role: 'assistant',
        text: plan.summary,
        createdAt: responseIso,
      });
      return;
    }

    setPendingPlans((prev) => ({
      ...prev,
      [assistantMsgId]: plan,
    }));

    appendAiChatMessage({
      id: assistantMsgId,
      role: 'assistant',
      text: plan.summary,
      createdAt: responseIso,
      plan: {
        summary: plan.summary,
        items: plan.steps,
        status: 'pending',
      },
    });
  };

  const handleApplyPlan = (messageId: string) => {
    const executablePlan = pendingPlans[messageId];
    if (!executablePlan) return;

    const result = executeAiPlan(executablePlan);
    if (!result.ok) {
      updateAiChatPlanStatus(messageId, {
        status: 'error',
        errorMessage: result.error,
      });
      onNotify?.(result.error);
      return;
    }

    updateAiChatPlanStatus(messageId, {
      status: 'applied',
      appliedAt: new Date().toISOString(),
    });
    setPendingPlans((prev) => {
      const next = { ...prev };
      delete next[messageId];
      return next;
    });
    onNotify?.(
      `Plan aplicado (${result.appliedCount} ${result.appliedCount === 1 ? 'cambio' : 'cambios'}). Puedes revertirlo con Deshacer.`,
    );
  };

  const handleClearChat = () => {
    setPendingPlans({});
    clearAiChatHistory();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <aside
      className={styles.drawer}
      aria-label="Asistente IA"
      role="complementary"
    >
      <header className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <h2 className={styles.title}>Asistente IA</h2>
          <span
            className={`${styles.statusBadge} ${isConfigured ? styles.statusReady : styles.statusUnconfigured}`}
            title={
              isConfigured
                ? `Google Gemini (${config.model})`
                : 'Sin configurar'
            }
          >
            {isConfigured ? config.model : 'Sin configurar'}
          </span>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onOpenSettings}
            title="Configuración de IA"
            aria-label="Abrir configuración de IA"
          >
            ⚙
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={handleClearChat}
            disabled={chatHistory.length === 0 || sending}
            title="Limpiar historial de chat"
            aria-label="Limpiar historial de chat"
          >
            ⌫
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            title="Cerrar panel de Asistente IA"
            aria-label="Cerrar Asistente IA"
          >
            ✕
          </button>
        </div>
      </header>

      <div className={styles.messages}>
        {!isConfigured ? (
          <div className={styles.emptyCard}>
            <p className={styles.emptyTitle}>Conecta Google Gemini</p>
            <p className={styles.emptyText}>
              Configura tu clave de API de Gemini para construir y editar piezas
              con lenguaje natural. El editor 3D manual sigue funcionando al
              100&nbsp;% sin conexión.
            </p>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={onOpenSettings}
            >
              Configurar Gemini
            </button>
          </div>
        ) : chatHistory.length === 0 ? (
          <div className={styles.emptyCard}>
            <p className={styles.emptyTitle}>¿Qué quieres construir hoy?</p>
            <p className={styles.emptyText}>
              Describe piezas, medidas o cambios. Primero verás un plan claro y
              nada cambiará en la escena hasta que pulses <strong>Aplicar</strong>.
            </p>
            <div className={styles.examples}>
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  className={styles.exampleBtn}
                  onClick={() => void handleSend(example)}
                  disabled={sending}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          chatHistory.map((msg) => {
            const executablePlan = pendingPlans[msg.id];
            const isUser = msg.role === 'user';
            return (
              <article
                key={msg.id}
                className={`${styles.message} ${isUser ? styles.messageUser : styles.messageAssistant}`}
              >
                <div className={styles.messageMeta}>
                  <span>{isUser ? 'Tú' : 'Asistente IA'}</span>
                  <time>{formatTime(msg.createdAt)}</time>
                </div>
                <p className={styles.messageText}>{msg.text}</p>

                {msg.plan && (
                  <div
                    className={`${styles.planCard} ${
                      msg.plan.status === 'applied'
                        ? styles.planApplied
                        : msg.plan.status === 'error'
                          ? styles.planError
                          : styles.planPending
                    }`}
                  >
                    <div className={styles.planHeader}>
                      <span className={styles.planLabel}>Plan propuesto</span>
                      <span className={styles.planState}>
                        {msg.plan.status === 'applied'
                          ? 'Aplicado'
                          : msg.plan.status === 'error'
                            ? 'Error'
                            : 'Pendiente'}
                      </span>
                    </div>

                    {msg.plan.items.length > 0 && (
                      <ul className={styles.planSteps}>
                        {msg.plan.items.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    )}

                    {msg.plan.status === 'pending' && executablePlan && (
                      <button
                        type="button"
                        className={styles.applyBtn}
                        onClick={() => handleApplyPlan(msg.id)}
                      >
                        Aplicar plan ({executablePlan.commands.length}{' '}
                        {executablePlan.commands.length === 1
                          ? 'acción'
                          : 'acciones'}
                        )
                      </button>
                    )}

                    {msg.plan.status === 'pending' && !executablePlan && (
                      <p className={styles.planNote}>
                        Plan guardado de una sesión anterior. Pide al asistente
                        regenerarlo si deseas aplicarlo ahora.
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}

        {sending && (
          <div className={styles.loadingPill} role="status">
            Generando plan con {config.model}…
          </div>
        )}
        <div ref={listEndRef} />
      </div>

      <footer className={styles.composer}>
        <textarea
          className={styles.textarea}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isConfigured
              ? 'Ej. Crea una repisa de 80 × 25 × 2 cm a 120 cm del suelo…'
              : 'Configura tu API Key de Gemini para escribir aquí…'
          }
          disabled={!isConfigured || sending}
          aria-label="Mensaje para el Asistente IA"
        />
        <div className={styles.composerActions}>
          <span className={styles.composerHint}>
            Enter envía · Shift+Enter nueva línea
          </span>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => void handleSend()}
            disabled={!isConfigured || sending || !draft.trim()}
          >
            {sending ? 'Pensando…' : 'Enviar'}
          </button>
        </div>
      </footer>
    </aside>
  );
}
