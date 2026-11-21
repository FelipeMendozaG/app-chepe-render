import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { getAiProviderAdapter, type AiConnectionTestResult } from '../../ai';
import {
  DEFAULT_GEMINI_BASE_URL,
  GEMINI_MODEL_SUGGESTIONS,
  clearAiConfig,
  saveAiConfig,
  type AiProviderConfig,
} from '../../persistence';
import styles from './AiSettingsModal.module.css';

interface AiSettingsModalProps {
  open: boolean;
  config: AiProviderConfig;
  onConfigChange: (config: AiProviderConfig) => void;
  onClose: () => void;
  onNotify?: (message: string) => void;
}

export function AiSettingsModal({
  open,
  config,
  onConfigChange,
  onClose,
  onNotify,
}: AiSettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const modelListId = useId();

  const [apiKey, setApiKey] = useState(config.apiKey);
  const [model, setModel] = useState(config.model);
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [sessionOnly, setSessionOnly] = useState(config.sessionOnly);
  const [showKey, setShowKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(
    config.baseUrl !== DEFAULT_GEMINI_BASE_URL,
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AiConnectionTestResult | null>(
    null,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      setApiKey(config.apiKey);
      setModel(config.model);
      setBaseUrl(config.baseUrl);
      setSessionOnly(config.sessionOnly);
      setShowKey(false);
      setShowAdvanced(config.baseUrl !== DEFAULT_GEMINI_BASE_URL);
      setTestResult(null);
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, config]);

  const buildDraftConfig = (): AiProviderConfig => ({
    providerId: 'gemini',
    apiKey: apiKey.trim(),
    model: model.trim(),
    baseUrl: baseUrl.trim() || DEFAULT_GEMINI_BASE_URL,
    sessionOnly,
  });

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const draft = buildDraftConfig();
    const adapter = getAiProviderAdapter(draft.providerId);
    const result = await adapter.testConnection(draft);
    setTesting(false);
    setTestResult(result);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const saved = saveAiConfig(buildDraftConfig());
    onConfigChange(saved);
    onNotify?.(
      saved.sessionOnly
        ? 'Configuración de Gemini guardada solo para esta sesión'
        : 'Configuración de Gemini guardada localmente',
    );
    onClose();
  };

  const handleClear = () => {
    const cleared = clearAiConfig();
    onConfigChange(cleared);
    setApiKey('');
    setModel(cleared.model);
    setBaseUrl(cleared.baseUrl);
    setSessionOnly(false);
    setTestResult(null);
    onNotify?.('Credenciales de IA eliminadas del navegador');
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <form className={styles.card} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <h2 id={titleId} className={styles.title}>
              Configuración de IA
            </h2>
            <p className={styles.subtitle}>
              Conector activo: <strong>Google Gemini</strong> (arquitectura lista para más proveedores).
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar configuración de IA"
          >
            ✕
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="ai-gemini-key">
              API Key de Google Gemini
            </label>
            <div className={styles.keyRow}>
              <input
                id="ai-gemini-key"
                type={showKey ? 'text' : 'password'}
                className={styles.input}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder="AIza..."
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setShowKey((prev) => !prev)}
              >
                {showKey ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <p className={styles.hint}>
              Se guarda solo en este navegador y nunca se incluye al exportar el archivo <code>.chepita.json</code>.
            </p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="ai-gemini-model">
              Modelo activo
            </label>
            <input
              id="ai-gemini-model"
              type="text"
              list={modelListId}
              className={styles.input}
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setTestResult(null);
              }}
              placeholder="gemini-2.5-flash"
              spellCheck={false}
            />
            <datalist id={modelListId}>
              {GEMINI_MODEL_SUGGESTIONS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={sessionOnly}
              onChange={(e) => setSessionOnly(e.target.checked)}
            />
            <span>Guardar solo en esta sesión (se borra al cerrar la pestaña)</span>
          </label>

          <div className={styles.advancedBlock}>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => setShowAdvanced((prev) => !prev)}
            >
              {showAdvanced ? '▾ Ocultar opciones avanzadas' : '▸ Opciones avanzadas (URL base)'}
            </button>
            {showAdvanced && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ai-gemini-baseurl">
                  URL base del servicio
                </label>
                <input
                  id="ai-gemini-baseurl"
                  type="url"
                  className={styles.input}
                  value={baseUrl}
                  onChange={(e) => {
                    setBaseUrl(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder={DEFAULT_GEMINI_BASE_URL}
                  spellCheck={false}
                />
              </div>
            )}
          </div>

          <div className={styles.testRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? 'Probando conexión…' : 'Probar modelo'}
            </button>
            {testResult && (
              <p
                className={
                  testResult.ok ? styles.testSuccess : styles.testError
                }
                role="status"
              >
                {testResult.message}
                {testResult.ok && testResult.latencyMs !== undefined
                  ? ` (${testResult.latencyMs} ms)`
                  : ''}
              </p>
            )}
          </div>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.dangerBtn}
            onClick={handleClear}
            disabled={!config.apiKey && !apiKey}
          >
            Borrar credenciales
          </button>
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.primaryBtn}>
              Guardar
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
