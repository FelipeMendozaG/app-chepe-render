import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import styles from './NumberField.module.css';

interface NumberFieldProps {
  label: string;
  value: number;
  unitSuffix?: string;
  step?: number;
  disabled?: boolean;
  readOnly?: boolean;
  minPositive?: boolean;
  positiveErrorUnit?: string;
  onCommit: (nextValue: number) => void;
}

export function NumberField({
  label,
  value,
  unitSuffix,
  step = 1,
  disabled = false,
  readOnly = false,
  minPositive = false,
  positiveErrorUnit,
  onCommit,
}: NumberFieldProps) {
  const inputId = useId();
  const errorId = useId();
  const [draft, setDraft] = useState(() => String(value));
  const [isFocused, setIsFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastCommittedValueRef = useRef(value);

  useEffect(() => {
    if (!isFocused && value !== lastCommittedValueRef.current) {
      lastCommittedValueRef.current = value;
      setDraft(String(value));
      setError(null);
      setTouched(false);
    }
  }, [value, isFocused]);

  const validateRaw = (raw: string): { valid: boolean; num: number; err: string | null } => {
    const normalized = raw.trim().replace(',', '.');
    if (normalized.length === 0) {
      return {
        valid: false,
        num: NaN,
        err: `Introduce un valor numérico para ${label.toLowerCase()}.`,
      };
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return {
        valid: false,
        num: NaN,
        err: `El valor de ${label.toLowerCase()} no es válido.`,
      };
    }
    if (minPositive && parsed <= 0) {
      const suffix = positiveErrorUnit ?? unitSuffix ?? '';
      return {
        valid: false,
        num: parsed,
        err: `${label} debe ser mayor que 0${suffix ? ` ${suffix}` : ''} para generar la pieza.`,
      };
    }
    return { valid: true, num: parsed, err: null };
  };

  const handleChange = (raw: string) => {
    setDraft(raw);
    const check = validateRaw(raw);
    if (check.valid) {
      setError(null);
      lastCommittedValueRef.current = check.num;
      if (check.num !== value) {
        onCommit(check.num);
      }
    } else if (touched) {
      setError(check.err);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    setTouched(true);
    const check = validateRaw(draft);
    if (check.valid) {
      setError(null);
      lastCommittedValueRef.current = check.num;
      setDraft(String(check.num));
      if (check.num !== value) {
        onCommit(check.num);
      }
    } else {
      setError(check.err);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      setDraft(String(value));
      setError(null);
      event.currentTarget.blur();
    }
  };

  const showError = Boolean(error);

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        <span>{label}</span>
        {unitSuffix && <span className={styles.unit}>{unitSuffix}</span>}
      </label>
      <input
        id={inputId}
        type="number"
        inputMode="decimal"
        step={step}
        value={draft}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={showError ? 'true' : 'false'}
        aria-describedby={showError ? errorId : undefined}
        className={`${styles.input} ${showError ? styles.inputInvalid : ''}`}
        onFocus={() => setIsFocused(true)}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {showError && (
        <div id={errorId} className={styles.errorText}>
          {error}
        </div>
      )}
    </div>
  );
}
