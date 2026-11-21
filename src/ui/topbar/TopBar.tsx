import { type DisplayUnit } from '../../domain';
import { canRedo, canUndo, useProjectStore } from '../../store';
import styles from './TopBar.module.css';

interface TopBarProps {
  onOpenNewPiece: () => void;
  onOpenProjects: () => void;
}

const UNITS: DisplayUnit[] = ['mm', 'cm', 'm'];

export function TopBar({ onOpenNewPiece, onOpenProjects }: TopBarProps) {
  const projectName = useProjectStore((s) => s.document.project.name);
  const displayUnit = useProjectStore((s) => s.document.project.displayUnit);
  const settings = useProjectStore((s) => s.document.settings);
  const history = useProjectStore((s) => s.history);
  const isDirty = useProjectStore((s) => s.isDirty);
  const activeCameraPreset = useProjectStore(
    (s) => s.cameraPresetRequest.preset,
  );

  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const addGroup = useProjectStore((s) => s.addGroup);
  const setDisplayUnit = useProjectStore((s) => s.setDisplayUnit);
  const toggleSetting = useProjectStore((s) => s.toggleSetting);
  const requestCameraPreset = useProjectStore((s) => s.requestCameraPreset);

  return (
    <header className={styles.topbar}>
      <div className={styles.leftCluster}>
        <div className={styles.brand} title={projectName}>
          <span className={styles.brandMark} aria-hidden="true" />
          <div className={styles.brandText}>
            <span className={styles.appName}>CHEPITA 3D</span>
            <span className={styles.projectTitle}>
              {projectName}
              {isDirty && (
                <span
                  className={styles.dirtyDot}
                  title="Hay cambios sin guardar"
                  aria-label="Cambios sin guardar"
                />
              )}
            </span>
          </div>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.actionGroup}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={onOpenNewPiece}
          >
            + Nueva pieza
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => addGroup()}
          >
            + Nuevo grupo
          </button>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.actionGroup}>
          <button
            type="button"
            className={styles.btn}
            disabled={!canUndo(history)}
            onClick={undo}
            title="Deshacer último cambio"
          >
            ↶ Deshacer
          </button>
          <button
            type="button"
            className={styles.btn}
            disabled={!canRedo(history)}
            onClick={redo}
            title="Rehacer cambio"
          >
            ↷ Rehacer
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={onOpenProjects}
            title="Guardar, abrir o respaldar proyectos"
          >
            Guardar / Abrir
          </button>
        </div>
      </div>

      <div className={styles.rightCluster}>
        <div
          className={styles.unitGroup}
          role="group"
          aria-label="Unidad de medida activa"
        >
          {UNITS.map((unit) => (
            <button
              key={unit}
              type="button"
              className={`${styles.unitBtn} ${displayUnit === unit ? styles.unitBtnActive : ''}`}
              aria-pressed={displayUnit === unit}
              onClick={() => setDisplayUnit(unit)}
            >
              {unit}
            </button>
          ))}
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.actionGroup}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${activeCameraPreset === 'initial' ? styles.toggleBtnActive : ''}`}
            aria-pressed={activeCameraPreset === 'initial'}
            onClick={() => requestCameraPreset('initial')}
          >
            Vista inicial
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${settings.showDimensions ? styles.toggleBtnActive : ''}`}
            aria-pressed={settings.showDimensions}
            onClick={() => toggleSetting('showDimensions')}
          >
            Medidas
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${settings.showAccessories ? styles.toggleBtnActive : ''}`}
            aria-pressed={settings.showAccessories}
            onClick={() => toggleSetting('showAccessories')}
          >
            Accesorios
          </button>
        </div>
      </div>
    </header>
  );
}
