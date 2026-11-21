import { useMemo } from 'react';
import {
  buildEntityMap,
  isEntityEffectivelyLocked,
  isGroupEntity,
  type CameraPreset,
  type TransformToolMode,
} from '../../domain';
import { useProjectStore } from '../../store';
import { SummaryCard } from './SummaryCard';
import styles from './ViewportOverlay.module.css';

const CAMERA_VIEWS: Array<{ preset: CameraPreset; label: string }> = [
  { preset: 'front', label: 'Frontal' },
  { preset: 'side', label: 'Lateral' },
  { preset: 'top', label: 'Superior' },
  { preset: 'isometric', label: 'Isométrica' },
];

const TOOL_MODES: Array<{ mode: TransformToolMode; label: string }> = [
  { mode: 'translate', label: 'Mover' },
  { mode: 'rotate', label: 'Rotar' },
  { mode: 'scale', label: 'Escalar' },
];

export function ViewportOverlay() {
  const entities = useProjectStore((s) => s.document.entities);
  const selectedId = useProjectStore((s) => s.selectedId);
  const toolMode = useProjectStore((s) => s.toolMode);
  const activeCameraPreset = useProjectStore(
    (s) => s.cameraPresetRequest.preset,
  );
  const setToolMode = useProjectStore((s) => s.setToolMode);
  const requestCameraPreset = useProjectStore((s) => s.requestCameraPreset);

  const entitiesById = useMemo(() => buildEntityMap(entities), [entities]);
  const selectedEntity = selectedId ? entitiesById.get(selectedId) ?? null : null;
  const isLocked = selectedEntity
    ? isEntityEffectivelyLocked(selectedEntity, entitiesById)
    : false;
  const isGroup = selectedEntity ? isGroupEntity(selectedEntity) : false;

  return (
    <>
      <SummaryCard />

      <div className={styles.rightControls}>
        <div
          className={styles.pillGroup}
          role="toolbar"
          aria-label="Vistas predefinidas de cámara"
        >
          {CAMERA_VIEWS.map((view) => (
            <button
              key={view.preset}
              type="button"
              className={`${styles.ctrlBtn} ${activeCameraPreset === view.preset ? styles.ctrlBtnActive : ''}`}
              onClick={() => requestCameraPreset(view.preset)}
            >
              {view.label}
            </button>
          ))}
        </div>

        <div
          className={styles.pillGroup}
          role="toolbar"
          aria-label="Herramienta de transformación 3D"
        >
          {TOOL_MODES.map((item) => {
            const disabled =
              !selectedEntity ||
              isLocked ||
              (item.mode === 'scale' && isGroup);
            const title =
              item.mode === 'scale' && isGroup
                ? 'Escalar está deshabilitado para grupos'
                : isLocked
                  ? 'Elemento bloqueado'
                  : item.label;

            return (
              <button
                key={item.mode}
                type="button"
                disabled={disabled}
                title={title}
                aria-pressed={toolMode === item.mode && !disabled}
                className={`${styles.ctrlBtn} ${toolMode === item.mode && !disabled ? styles.ctrlBtnActive : ''}`}
                onClick={() => setToolMode(item.mode)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.hint}>
        Arrastra para girar · rueda para acercar/alejar · clic derecho para
        desplazar
      </div>
    </>
  );
}
