import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  DEFAULT_MATERIAL_ID,
  PRIMITIVE_LABELS,
  getDefaultGeometryForPrimitive,
  getUnitStep,
  metersToUnit,
  unitToMeters,
  validateGeometry,
  hasBlockingErrors,
  type EntityLayer,
  type GeometryParams,
  type PrimitiveType,
} from '../../domain';
import { useProjectStore } from '../../store';
import styles from './NewPieceModal.module.css';

interface NewPieceModalProps {
  open: boolean;
  onClose: () => void;
}

const PRIMITIVE_OPTIONS: Array<{ type: PrimitiveType; shortLabel: string }> = [
  { type: 'box', shortLabel: 'Caja / Tablero' },
  { type: 'cylinder', shortLabel: 'Cilindro / Tubo' },
  { type: 'sphere', shortLabel: 'Esfera' },
  { type: 'plane', shortLabel: 'Superficie / Plano' },
];

export function NewPieceModal({ open, onClose }: NewPieceModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const errorId = useId();

  const displayUnit = useProjectStore((s) => s.document.project.displayUnit);
  const materials = useProjectStore((s) => s.document.materials);
  const addPrimitive = useProjectStore((s) => s.addPrimitive);

  const [type, setType] = useState<PrimitiveType>('box');
  const [name, setName] = useState('');
  const [layer, setLayer] = useState<EntityLayer>('main');
  const [materialId, setMaterialId] = useState(DEFAULT_MATERIAL_ID);
  const [useRadius, setUseRadius] = useState(false);

  // Raw form values in active displayUnit
  const [width, setWidth] = useState('60');
  const [height, setHeight] = useState('40');
  const [depth, setDepth] = useState('40');
  const [radialValue, setRadialValue] = useState('20');
  const [formError, setFormError] = useState<string | null>(null);

  const resetDefaultsForType = (nextType: PrimitiveType, radiusMode: boolean) => {
    const def = getDefaultGeometryForPrimitive(nextType);
    setFormError(null);
    switch (nextType) {
      case 'box': {
        const g = def as { width: number; height: number; depth: number };
        setWidth(String(metersToUnit(g.width, displayUnit)));
        setHeight(String(metersToUnit(g.height, displayUnit)));
        setDepth(String(metersToUnit(g.depth, displayUnit)));
        break;
      }
      case 'cylinder': {
        const g = def as { radius: number; height: number };
        const radialMeters = radiusMode ? g.radius : g.radius * 2;
        setRadialValue(String(metersToUnit(radialMeters, displayUnit)));
        setHeight(String(metersToUnit(g.height, displayUnit)));
        break;
      }
      case 'sphere': {
        const g = def as { radius: number };
        const radialMeters = radiusMode ? g.radius : g.radius * 2;
        setRadialValue(String(metersToUnit(radialMeters, displayUnit)));
        break;
      }
      case 'plane': {
        const g = def as { width: number; depth: number };
        setWidth(String(metersToUnit(g.width, displayUnit)));
        setDepth(String(metersToUnit(g.depth, displayUnit)));
        break;
      }
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      setName('');
      setLayer('main');
      setMaterialId(materials[0]?.id ?? DEFAULT_MATERIAL_ID);
      resetDefaultsForType(type, useRadius);
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fallback for browsers without native <dialog closedby="any"> light-dismiss
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || 'closedBy' in HTMLDialogElement.prototype) return;

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    let pressedOutside = false;
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        dialog.close();
      }
      pressedOutside = false;
    };

    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('pointerup', onPointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  const handleClose = () => {
    if (dialogRef.current) {
      dialogRef.current.returnValue = '';
    }
    onClose();
  };

  const handleTypeSelect = (nextType: PrimitiveType) => {
    setType(nextType);
    resetDefaultsForType(nextType, useRadius);
  };

  const handleToggleRadialMode = (nextUseRadius: boolean) => {
    const parsed = Number(radialValue.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0) {
      const converted = nextUseRadius ? parsed / 2 : parsed * 2;
      setRadialValue(String(Number(converted.toFixed(4))));
    }
    setUseRadius(nextUseRadius);
  };

  const parseField = (raw: string): number => {
    const trimmed = raw.trim().replace(',', '.');
    if (!trimmed) return NaN;
    return Number(trimmed);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    let geometry: GeometryParams;
    switch (type) {
      case 'box':
        geometry = {
          width: unitToMeters(parseField(width), displayUnit),
          height: unitToMeters(parseField(height), displayUnit),
          depth: unitToMeters(parseField(depth), displayUnit),
        };
        break;
      case 'cylinder': {
        const rawRadial = parseField(radialValue);
        const radiusMeters = unitToMeters(
          useRadius ? rawRadial : rawRadial / 2,
          displayUnit,
        );
        geometry = {
          radius: radiusMeters,
          height: unitToMeters(parseField(height), displayUnit),
          radialSegments: 32,
        };
        break;
      }
      case 'sphere': {
        const rawRadial = parseField(radialValue);
        const radiusMeters = unitToMeters(
          useRadius ? rawRadial : rawRadial / 2,
          displayUnit,
        );
        geometry = {
          radius: radiusMeters,
          widthSegments: 32,
          heightSegments: 24,
        };
        break;
      }
      case 'plane':
        geometry = {
          width: unitToMeters(parseField(width), displayUnit),
          depth: unitToMeters(parseField(depth), displayUnit),
        };
        break;
    }

    const issues = validateGeometry(type, geometry, displayUnit);
    if (hasBlockingErrors(issues)) {
      setFormError(issues.find((i) => i.severity === 'error')?.message ?? 'Revisa las medidas ingresadas.');
      return;
    }

    const createdId = addPrimitive({
      type,
      name: name.trim() || undefined,
      geometry,
      layer,
      materialId,
    });

    if (!createdId) {
      setFormError('No se pudo crear la pieza. Verifica los valores ingresados.');
      return;
    }

    dialogRef.current?.close();
    onClose();
  };

  const step = getUnitStep(displayUnit);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={handleClose}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className={styles.header}>
        <div>
          <h2 id={titleId} className={styles.title}>
            Nueva pieza
          </h2>
          <p className={styles.subtitle}>
            Se apoyará automáticamente sobre el suelo (Y = 0) en {displayUnit}.
          </p>
        </div>
        <button
          type="button"
          className={styles.closeBtn}
          aria-label="Cerrar ventana"
          onClick={() => dialogRef.current?.close()}
        >
          ✕
        </button>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Forma base</span>
          <div className={styles.typeGrid}>
            {PRIMITIVE_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                type="button"
                className={`${styles.typeBtn} ${type === opt.type ? styles.typeBtnActive : ''}`}
                onClick={() => handleTypeSelect(opt.type)}
              >
                {opt.shortLabel}
              </button>
            ))}
          </div>
          <span className={styles.typeHint}>{PRIMITIVE_LABELS[type]}</span>
        </div>

        <div className={styles.rowTwo}>
          <label className={styles.field}>
            <span>Nombre (opcional)</span>
            <input
              type="text"
              placeholder="Automático (ej. Caja 1)"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span>Capa</span>
            <select
              value={layer}
              onChange={(e) => setLayer(e.target.value as EntityLayer)}
            >
              <option value="main">Principal</option>
              <option value="accessories">Accesorios</option>
            </select>
          </label>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Medidas ({displayUnit})</span>
            {(type === 'cylinder' || type === 'sphere') && (
              <div className={styles.miniToggle} role="group" aria-label="Modo radial">
                <button
                  type="button"
                  className={!useRadius ? styles.miniToggleActive : ''}
                  onClick={() => handleToggleRadialMode(false)}
                >
                  Diámetro
                </button>
                <button
                  type="button"
                  className={useRadius ? styles.miniToggleActive : ''}
                  onClick={() => handleToggleRadialMode(true)}
                >
                  Radio
                </button>
              </div>
            )}
          </div>

          {type === 'box' && (
            <div className={styles.rowThree}>
              <label className={styles.field}>
                <span>Ancho ({displayUnit})</span>
                <input
                  type="number"
                  step={step}
                  value={width}
                  aria-invalid={formError ? 'true' : 'false'}
                  aria-describedby={formError ? errorId : undefined}
                  onChange={(e) => setWidth(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Alto ({displayUnit})</span>
                <input
                  type="number"
                  step={step}
                  value={height}
                  aria-invalid={formError ? 'true' : 'false'}
                  aria-describedby={formError ? errorId : undefined}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Profundidad ({displayUnit})</span>
                <input
                  type="number"
                  step={step}
                  value={depth}
                  aria-invalid={formError ? 'true' : 'false'}
                  aria-describedby={formError ? errorId : undefined}
                  onChange={(e) => setDepth(e.target.value)}
                />
              </label>
            </div>
          )}

          {type === 'cylinder' && (
            <div className={styles.rowTwo}>
              <label className={styles.field}>
                <span>
                  {useRadius ? 'Radio' : 'Diámetro'} ({displayUnit})
                </span>
                <input
                  type="number"
                  step={step}
                  value={radialValue}
                  aria-invalid={formError ? 'true' : 'false'}
                  aria-describedby={formError ? errorId : undefined}
                  onChange={(e) => setRadialValue(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Alto ({displayUnit})</span>
                <input
                  type="number"
                  step={step}
                  value={height}
                  aria-invalid={formError ? 'true' : 'false'}
                  aria-describedby={formError ? errorId : undefined}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </label>
            </div>
          )}

          {type === 'sphere' && (
            <label className={styles.field}>
              <span>
                {useRadius ? 'Radio' : 'Diámetro'} ({displayUnit})
              </span>
              <input
                type="number"
                step={step}
                value={radialValue}
                aria-invalid={formError ? 'true' : 'false'}
                aria-describedby={formError ? errorId : undefined}
                onChange={(e) => setRadialValue(e.target.value)}
              />
            </label>
          )}

          {type === 'plane' && (
            <div className={styles.rowTwo}>
              <label className={styles.field}>
                <span>Ancho ({displayUnit})</span>
                <input
                  type="number"
                  step={step}
                  value={width}
                  aria-invalid={formError ? 'true' : 'false'}
                  aria-describedby={formError ? errorId : undefined}
                  onChange={(e) => setWidth(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Largo ({displayUnit})</span>
                <input
                  type="number"
                  step={step}
                  value={depth}
                  aria-invalid={formError ? 'true' : 'false'}
                  aria-describedby={formError ? errorId : undefined}
                  onChange={(e) => setDepth(e.target.value)}
                />
              </label>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>Material inicial</span>
          <div className={styles.swatches}>
            {materials.slice(0, 7).map((mat) => (
              <button
                key={mat.id}
                type="button"
                title={mat.name}
                className={`${styles.swatch} ${materialId === mat.id ? styles.swatchActive : ''}`}
                onClick={() => setMaterialId(mat.id)}
              >
                <span
                  className={styles.swatchDot}
                  style={{ backgroundColor: mat.color }}
                />
                <span className={styles.swatchName}>{mat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {formError && (
          <div id={errorId} className={styles.errorBanner} role="alert">
            {formError}
          </div>
        )}

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => dialogRef.current?.close()}
          >
            Cancelar
          </button>
          <button type="submit" className={styles.submitBtn}>
            Crear pieza
          </button>
        </div>
      </form>
    </dialog>
  );
}
