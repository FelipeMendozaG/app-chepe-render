import { useMemo, useState, type DragEvent } from 'react';
import {
  QUICK_OBJECT_PRESETS,
  formatLengthValue,
  isGroupEntity,
  type DisplayUnit,
  type Entity,
  type QuickObjectCategory,
  type QuickObjectPreset,
} from '../../domain';
import { useProjectStore } from '../../store';
import styles from './LeftPanel.module.css';

export const QUICK_OBJECT_DRAG_MIME = 'application/x-chepita-quick-preset';

interface LeftPanelProps {
  onPresetDragStart?: (presetId: string) => void;
  onPresetDragEnd?: () => void;
}

const CATEGORY_ORDER: Array<{ id: QuickObjectCategory; label: string }> = [
  { id: 'boards', label: 'Tableros y cajas' },
  { id: 'bars', label: 'Barras y soportes' },
  { id: 'shapes', label: 'Formas base' },
];

function formatPresetSummary(preset: QuickObjectPreset, unit: DisplayUnit): string {
  switch (preset.type) {
    case 'box': {
      const g = preset.geometry as { width: number; height: number; depth: number };
      return `${formatLengthValue(g.width, unit)} × ${formatLengthValue(g.height, unit)} × ${formatLengthValue(g.depth, unit)} ${unit}`;
    }
    case 'cylinder': {
      const g = preset.geometry as { radius: number; height: number };
      return `Ø ${formatLengthValue(g.radius * 2, unit)} × ${formatLengthValue(g.height, unit)} ${unit}`;
    }
    case 'sphere': {
      const g = preset.geometry as { radius: number };
      return `Ø ${formatLengthValue(g.radius * 2, unit)} ${unit}`;
    }
    case 'plane': {
      const g = preset.geometry as { width: number; depth: number };
      return `${formatLengthValue(g.width, unit)} × ${formatLengthValue(g.depth, unit)} ${unit}`;
    }
  }
}

function getEntityTypeBadge(type: Entity['type']): string {
  switch (type) {
    case 'group':
      return '▣';
    case 'box':
      return '▭';
    case 'cylinder':
      return '⬭';
    case 'sphere':
      return '●';
    case 'plane':
      return '▱';
  }
}

export function LeftPanel({
  onPresetDragStart,
  onPresetDragEnd,
}: LeftPanelProps) {
  const entities = useProjectStore((s) => s.document.entities);
  const displayUnit = useProjectStore((s) => s.document.project.displayUnit);
  const selectedId = useProjectStore((s) => s.selectedId);

  const addQuickObject = useProjectStore((s) => s.addQuickObject);
  const addGroup = useProjectStore((s) => s.addGroup);
  const selectEntity = useProjectStore((s) => s.selectEntity);
  const toggleEntityVisible = useProjectStore((s) => s.toggleEntityVisible);
  const toggleEntityLocked = useProjectStore((s) => s.toggleEntityLocked);
  const ungroupEntity = useProjectStore((s) => s.ungroupEntity);
  const deleteEntity = useProjectStore((s) => s.deleteEntity);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [quickOpen, setQuickOpen] = useState(true);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, Entity[]>();
    for (const entity of entities) {
      const list = map.get(entity.parentId) ?? [];
      list.push(entity);
      map.set(entity.parentId, list);
    }
    return map;
  }, [entities]);

  const selectedEntity = useMemo(
    () => entities.find((e) => e.id === selectedId) ?? null,
    [entities, selectedId],
  );

  const handleDragStart = (
    event: DragEvent<HTMLButtonElement>,
    presetId: string,
  ) => {
    event.dataTransfer.setData(QUICK_OBJECT_DRAG_MIME, presetId);
    event.dataTransfer.setData('text/plain', presetId);
    event.dataTransfer.effectAllowed = 'copy';
    onPresetDragStart?.(presetId);
  };

  const renderTreeNodes = (parentId: string | null, depth: number) => {
    const items = childrenByParent.get(parentId) ?? [];
    return items.map((entity) => {
      const isGroup = isGroupEntity(entity);
      const isSelected = entity.id === selectedId;
      const isCollapsed = Boolean(collapsedGroups[entity.id]);
      const hasChildren = (childrenByParent.get(entity.id)?.length ?? 0) > 0;

      return (
        <div key={entity.id} className={styles.treeNode}>
          <div
            className={`${styles.treeRow} ${isSelected ? styles.treeRowSelected : ''} ${!entity.visible ? styles.treeRowHidden : ''}`}
            style={{ paddingLeft: `${8 + depth * 14}px` }}
          >
            {isGroup ? (
              <button
                type="button"
                className={styles.expandBtn}
                aria-label={isCollapsed ? 'Expandir grupo' : 'Contraer grupo'}
                onClick={() =>
                  setCollapsedGroups((prev) => ({
                    ...prev,
                    [entity.id]: !prev[entity.id],
                  }))
                }
              >
                {hasChildren ? (isCollapsed ? '▸' : '▾') : '·'}
              </button>
            ) : (
              <span className={styles.expandSpacer} aria-hidden="true" />
            )}

            <button
              type="button"
              className={styles.treeSelectBtn}
              onClick={() => selectEntity(entity.id)}
            >
              <span className={styles.typeIcon} aria-hidden="true">
                {getEntityTypeBadge(entity.type)}
              </span>
              <span className={styles.entityName}>{entity.name}</span>
              {entity.layer === 'accessories' && (
                <span className={styles.accBadge} title="Capa Accesorios">
                  Acc
                </span>
              )}
            </button>

            <div className={styles.rowActions}>
              <button
                type="button"
                className={`${styles.iconBtn} ${!entity.visible ? styles.iconBtnMuted : ''}`}
                title={entity.visible ? 'Ocultar' : 'Mostrar'}
                aria-label={entity.visible ? `Ocultar ${entity.name}` : `Mostrar ${entity.name}`}
                onClick={() => toggleEntityVisible(entity.id)}
              >
                {entity.visible ? '👁' : '◌'}
              </button>
              <button
                type="button"
                className={`${styles.iconBtn} ${entity.locked ? styles.iconBtnLocked : ''}`}
                title={entity.locked ? 'Desbloquear' : 'Bloquear'}
                aria-label={entity.locked ? `Desbloquear ${entity.name}` : `Bloquear ${entity.name}`}
                onClick={() => toggleEntityLocked(entity.id)}
              >
                {entity.locked ? '🔒' : '🔓'}
              </button>
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                title="Eliminar"
                aria-label={`Eliminar ${entity.name}`}
                onClick={() => deleteEntity(entity.id)}
              >
                ✕
              </button>
            </div>
          </div>

          {isGroup && !isCollapsed && renderTreeNodes(entity.id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <aside className={styles.panel} aria-label="Objetos rápidos y árbol">
      <section className={styles.quickSection}>
        <button
          type="button"
          className={styles.sectionToggle}
          aria-expanded={quickOpen}
          onClick={() => setQuickOpen((v) => !v)}
        >
          <span>Objetos rápidos</span>
          <span className={styles.chevron}>{quickOpen ? '▾' : '▸'}</span>
        </button>

        {quickOpen && (
          <div className={styles.quickBody}>
            <p className={styles.quickHint}>
              Haz clic para insertar en el suelo o arrastra a la escena 3D.
            </p>
            {CATEGORY_ORDER.map((category) => {
              const presets = QUICK_OBJECT_PRESETS.filter(
                (p) => p.category === category.id,
              );
              return (
                <div key={category.id} className={styles.categoryGroup}>
                  <h3 className={styles.categoryTitle}>{category.label}</h3>
                  <div className={styles.presetList}>
                    {presets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        draggable
                        className={styles.presetCard}
                        onClick={() => addQuickObject(preset.id)}
                        onDragStart={(e) => handleDragStart(e, preset.id)}
                        onDragEnd={() => onPresetDragEnd?.()}
                        title={`Insertar ${preset.label}`}
                      >
                        <span className={styles.presetIcon} aria-hidden="true">
                          {getEntityTypeBadge(preset.type)}
                        </span>
                        <span className={styles.presetText}>
                          <span className={styles.presetLabel}>{preset.label}</span>
                          <span className={styles.presetDims}>
                            {formatPresetSummary(preset, displayUnit)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.treeSection}>
        <div className={styles.treeHeader}>
          <h2 className={styles.sectionHeading}>
            Árbol del modelo ({entities.length})
          </h2>
          {selectedEntity && (
            <div className={styles.treeQuickActions}>
              {isGroupEntity(selectedEntity) ? (
                <button
                  type="button"
                  className={styles.miniActionBtn}
                  onClick={() => ungroupEntity(selectedEntity.id)}
                  title="Desagrupar y conservar piezas hijas"
                >
                  Desagrupar
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.miniActionBtn}
                  onClick={() => addGroup({ wrapEntityId: selectedEntity.id })}
                  title="Crear un grupo alrededor de esta pieza"
                >
                  Agrupar
                </button>
              )}
            </div>
          )}
        </div>

        <div className={styles.treeBody}>
          {entities.length === 0 ? (
            <div className={styles.emptyTree}>
              Lienzo vacío. Elige un <strong>Objeto rápido</strong> arriba o
              pulsa <strong>+ Nueva pieza</strong> para empezar.
            </div>
          ) : (
            renderTreeNodes(null, 0)
          )}
        </div>
      </section>
    </aside>
  );
}
