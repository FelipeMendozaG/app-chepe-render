import { useEffect, useId, useMemo, useState } from 'react';
import {
  DEFAULT_MATERIALS,
  PRIMITIVE_LABELS,
  aabbToDimensions,
  analyzeGroupGeometryWarnings,
  buildEntityMap,
  canReparent,
  degreesToRadians,
  formatLength,
  getDescendantPrimitives,
  getEntityWorldAABB,
  getUnitStep,
  isEntityEffectivelyLocked,
  isGroupEntity,
  isPrimitiveEntity,
  metersToUnit,
  radiansToDegrees,
  unitToMeters,
  validateEntityName,
  validateGeometry,
  type Entity,
  type EntityLayer,
  type MaterialDef,
} from '../../domain';
import { useProjectStore } from '../../store';
import { NumberField } from '../components/NumberField';
import styles from './RightPanel.module.css';

export function RightPanel() {
  const project = useProjectStore((s) => s.document.project);
  const settings = useProjectStore((s) => s.document.settings);
  const entities = useProjectStore((s) => s.document.entities);
  const materials = useProjectStore((s) => s.document.materials);
  const selectedId = useProjectStore((s) => s.selectedId);

  const updateProjectMeta = useProjectStore((s) => s.updateProjectMeta);
  const toggleSetting = useProjectStore((s) => s.toggleSetting);
  const renameEntity = useProjectStore((s) => s.renameEntity);
  const reparentEntity = useProjectStore((s) => s.reparentEntity);
  const setEntityLayer = useProjectStore((s) => s.setEntityLayer);
  const updateEntityTransform = useProjectStore((s) => s.updateEntityTransform);
  const updatePrimitiveGeometry = useProjectStore(
    (s) => s.updatePrimitiveGeometry,
  );
  const assignMaterialToEntity = useProjectStore(
    (s) => s.assignMaterialToEntity,
  );
  const updateEntityMaterialAppearance = useProjectStore(
    (s) => s.updateEntityMaterialAppearance,
  );
  const beginTransaction = useProjectStore((s) => s.beginTransaction);
  const commitTransaction = useProjectStore((s) => s.commitTransaction);

  const unit = project.displayUnit;
  const step = getUnitStep(unit);

  const entitiesById = useMemo(() => buildEntityMap(entities), [entities]);
  const selectedEntity = useMemo(
    () => (selectedId ? entitiesById.get(selectedId) ?? null : null),
    [selectedId, entitiesById],
  );

  const [useRadius, setUseRadius] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const nameErrorId = useId();

  useEffect(() => {
    setNameDraft(selectedEntity?.name ?? '');
    setNameError(null);
  }, [selectedEntity?.id, selectedEntity?.name]);

  const isLocked = useMemo(
    () =>
      selectedEntity
        ? isEntityEffectivelyLocked(selectedEntity, entitiesById)
        : false,
    [selectedEntity, entitiesById],
  );

  const availableParents = useMemo(() => {
    if (!selectedEntity) return [];
    return entities.filter(
      (e) =>
        isGroupEntity(e) && canReparent(selectedEntity.id, e.id, entities),
    );
  }, [selectedEntity, entities]);

  const groupEnvelope = useMemo(() => {
    if (!selectedEntity || !isGroupEntity(selectedEntity)) return null;
    const aabb = getEntityWorldAABB(selectedEntity.id, entities, {
      includeHidden: true,
      showAccessories: true,
    });
    return aabb ? aabbToDimensions(aabb) : null;
  }, [selectedEntity, entities]);

  const activeWarnings = useMemo(() => {
    if (!selectedEntity) return [];
    const warnings = [];

    if (isPrimitiveEntity(selectedEntity)) {
      const geomIssues = validateGeometry(
        selectedEntity.type,
        selectedEntity.geometry,
        unit,
      );
      warnings.push(...geomIssues.filter((i) => i.severity === 'warning'));
      if (selectedEntity.parentId) {
        const groupWarnings = analyzeGroupGeometryWarnings(
          selectedEntity.parentId,
          entities,
        ).filter((w) => w.entityId === selectedEntity.id);
        warnings.push(...groupWarnings);
      }
    } else {
      warnings.push(
        ...analyzeGroupGeometryWarnings(selectedEntity.id, entities),
      );
    }
    return warnings;
  }, [selectedEntity, entities, unit]);

  const activeMaterial: MaterialDef | null = useMemo(() => {
    if (!selectedEntity) return null;
    if (isPrimitiveEntity(selectedEntity)) {
      return (
        materials.find((m) => m.id === selectedEntity.materialId) ??
        materials[0] ??
        null
      );
    }
    const children = getDescendantPrimitives(selectedEntity.id, entities);
    if (children.length === 0) return null;
    return (
      materials.find((m) => m.id === children[0].materialId) ??
      materials[0] ??
      null
    );
  }, [selectedEntity, entities, materials]);

  const presetMaterials = useMemo(() => {
    const presetIds = new Set(DEFAULT_MATERIALS.map((m) => m.id));
    return materials.filter((m) => presetIds.has(m.id));
  }, [materials]);

  // Empty selection: show project info & visual preferences
  if (!selectedEntity) {
    return (
      <aside className={styles.panel} aria-label="Propiedades del proyecto">
        <div className={styles.header}>
          <h2 className={styles.title}>Proyecto</h2>
          <p className={styles.subtitle}>
            Selecciona una pieza o grupo para editar sus medidas.
          </p>
        </div>

        <div className={styles.body}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Información general</h3>
            <label className={styles.textField}>
              <span>Nombre del proyecto</span>
              <input
                type="text"
                value={project.name}
                onChange={(e) => updateProjectMeta({ name: e.target.value })}
              />
            </label>
            <label className={styles.textField}>
              <span>Descripción</span>
              <textarea
                rows={3}
                placeholder="Ej. Mueble a escala real..."
                value={project.description}
                onChange={(e) =>
                  updateProjectMeta({ description: e.target.value })
                }
              />
            </label>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Visualización</h3>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={settings.showGrid}
                onChange={() => toggleSetting('showGrid')}
              />
              <span>Mostrar cuadrícula del suelo</span>
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={settings.showAxes}
                onChange={() => toggleSetting('showAxes')}
              />
              <span>Mostrar ejes de referencia (X / Y / Z)</span>
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={settings.showSummaryCard}
                onChange={() => toggleSetting('showSummaryCard')}
              />
              <span>Mostrar ficha resumen en pantalla</span>
            </label>
          </section>
        </div>
      </aside>
    );
  }

  const handleCommitName = () => {
    const issue = validateEntityName(nameDraft);
    if (issue) {
      setNameError(issue.message);
      return;
    }
    setNameError(null);
    renameEntity(selectedEntity.id, nameDraft);
  };

  const updatePosAxis = (axis: 0 | 1 | 2, valueInUnit: number) => {
    const nextPos: [number, number, number] = [
      ...selectedEntity.transform.position,
    ];
    nextPos[axis] = unitToMeters(valueInUnit, unit);
    updateEntityTransform(selectedEntity.id, { position: nextPos });
  };

  const updateRotAxis = (axis: 0 | 1 | 2, valueInDeg: number) => {
    const nextRot: [number, number, number] = [
      ...selectedEntity.transform.rotation,
    ];
    nextRot[axis] = degreesToRadians(valueInDeg);
    updateEntityTransform(selectedEntity.id, { rotation: nextRot });
  };

  const isGroup = isGroupEntity(selectedEntity);
  const groupChildCount = isGroup
    ? getDescendantPrimitives(selectedEntity.id, entities).length
    : 0;

  return (
    <aside className={styles.panel} aria-label="Propiedades del elemento">
      <div className={styles.header}>
        <h2 className={styles.title}>{selectedEntity.name}</h2>
        <p className={styles.subtitle}>
          {isGroup
            ? `Grupo · ${groupChildCount} ${groupChildCount === 1 ? 'pieza' : 'piezas'}`
            : PRIMITIVE_LABELS[selectedEntity.type]}
        </p>
      </div>

      <div className={styles.body}>
        {isLocked && (
          <div className={styles.lockBanner} role="status">
            Bloqueado (solo lectura). Desbloquéalo en el árbol para editar.
          </div>
        )}

        {/* Identidad y organización */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>General</h3>

          <label className={styles.textField}>
            <span>Nombre</span>
            <input
              type="text"
              value={nameDraft}
              disabled={isLocked}
              aria-invalid={nameError ? 'true' : 'false'}
              aria-describedby={nameError ? nameErrorId : undefined}
              className={nameError ? styles.inputInvalid : ''}
              onChange={(e) => {
                setNameDraft(e.target.value);
                if (nameError) setNameError(null);
              }}
              onBlur={handleCommitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />
            {nameError && (
              <span id={nameErrorId} className={styles.errorText}>
                {nameError}
              </span>
            )}
          </label>

          <div className={styles.gridTwo}>
            <label className={styles.textField}>
              <span>Grupo padre</span>
              <select
                value={selectedEntity.parentId ?? ''}
                disabled={isLocked}
                onChange={(e) =>
                  reparentEntity(
                    selectedEntity.id,
                    e.target.value ? e.target.value : null,
                  )
                }
              >
                <option value="">Ninguno (raíz)</option>
                {availableParents.map((grp: Entity) => (
                  <option key={grp.id} value={grp.id}>
                    {grp.name}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.textField}>
              <span>Capa</span>
              <select
                value={selectedEntity.layer}
                disabled={isLocked}
                onChange={(e) =>
                  setEntityLayer(
                    selectedEntity.id,
                    e.target.value as EntityLayer,
                  )
                }
              >
                <option value="main">Principal</option>
                <option value="accessories">Accesorios</option>
              </select>
            </label>
          </div>
        </section>

        {/* Medidas */}
        <section className={styles.section}>
          <div className={styles.sectionHeaderRow}>
            <h3 className={styles.sectionTitle}>
              {isGroup ? 'Medidas envolventes' : `Medidas (${unit})`}
            </h3>
            {!isGroup &&
              (selectedEntity.type === 'cylinder' ||
                selectedEntity.type === 'sphere') && (
                <div className={styles.miniToggle} role="group" aria-label="Modo radial">
                  <button
                    type="button"
                    className={!useRadius ? styles.miniToggleActive : ''}
                    onClick={() => setUseRadius(false)}
                  >
                    Diámetro
                  </button>
                  <button
                    type="button"
                    className={useRadius ? styles.miniToggleActive : ''}
                    onClick={() => setUseRadius(true)}
                  >
                    Radio
                  </button>
                </div>
              )}
          </div>

          {isGroup && (
            <div className={styles.envelopeGrid}>
              {groupEnvelope ? (
                <>
                  <div className={styles.envelopeItem}>
                    <span>Ancho</span>
                    <strong>{formatLength(groupEnvelope.width, unit)}</strong>
                  </div>
                  <div className={styles.envelopeItem}>
                    <span>Alto</span>
                    <strong>{formatLength(groupEnvelope.height, unit)}</strong>
                  </div>
                  <div className={styles.envelopeItem}>
                    <span>Profundidad</span>
                    <strong>{formatLength(groupEnvelope.depth, unit)}</strong>
                  </div>
                </>
              ) : (
                <p className={styles.mutedNote}>
                  Agrega piezas a este grupo para ver sus medidas totales.
                </p>
              )}
            </div>
          )}

          {selectedEntity.type === 'box' && (
            <div className={styles.gridThree}>
              <NumberField
                label="Ancho"
                unitSuffix={unit}
                step={step}
                minPositive
                disabled={isLocked}
                value={metersToUnit(selectedEntity.geometry.width, unit)}
                onCommit={(v) =>
                  updatePrimitiveGeometry(selectedEntity.id, {
                    width: unitToMeters(v, unit),
                  })
                }
              />
              <NumberField
                label="Alto"
                unitSuffix={unit}
                step={step}
                minPositive
                disabled={isLocked}
                value={metersToUnit(selectedEntity.geometry.height, unit)}
                onCommit={(v) =>
                  updatePrimitiveGeometry(selectedEntity.id, {
                    height: unitToMeters(v, unit),
                  })
                }
              />
              <NumberField
                label="Profund."
                unitSuffix={unit}
                step={step}
                minPositive
                disabled={isLocked}
                value={metersToUnit(selectedEntity.geometry.depth, unit)}
                onCommit={(v) =>
                  updatePrimitiveGeometry(selectedEntity.id, {
                    depth: unitToMeters(v, unit),
                  })
                }
              />
            </div>
          )}

          {selectedEntity.type === 'cylinder' && (
            <>
              <div className={styles.gridTwo}>
                <NumberField
                  label={useRadius ? 'Radio' : 'Diámetro'}
                  unitSuffix={unit}
                  step={step}
                  minPositive
                  disabled={isLocked}
                  value={metersToUnit(
                    useRadius
                      ? selectedEntity.geometry.radius
                      : selectedEntity.geometry.radius * 2,
                    unit,
                  )}
                  onCommit={(v) =>
                    updatePrimitiveGeometry(selectedEntity.id, {
                      radius: unitToMeters(useRadius ? v : v / 2, unit),
                    })
                  }
                />
                <NumberField
                  label="Alto"
                  unitSuffix={unit}
                  step={step}
                  minPositive
                  disabled={isLocked}
                  value={metersToUnit(selectedEntity.geometry.height, unit)}
                  onCommit={(v) =>
                    updatePrimitiveGeometry(selectedEntity.id, {
                      height: unitToMeters(v, unit),
                    })
                  }
                />
              </div>

              <details className={styles.advancedDetails}>
                <summary>Opciones avanzadas</summary>
                <div className={styles.advancedBody}>
                  <NumberField
                    label="Segmentos radiales"
                    step={2}
                    minPositive
                    disabled={isLocked}
                    value={selectedEntity.geometry.radialSegments ?? 32}
                    onCommit={(v) =>
                      updatePrimitiveGeometry(selectedEntity.id, {
                        radialSegments: Math.max(6, Math.min(128, Math.round(v))),
                      })
                    }
                  />
                </div>
              </details>
            </>
          )}

          {selectedEntity.type === 'sphere' && (
            <>
              <NumberField
                label={useRadius ? 'Radio' : 'Diámetro'}
                unitSuffix={unit}
                step={step}
                minPositive
                disabled={isLocked}
                value={metersToUnit(
                  useRadius
                    ? selectedEntity.geometry.radius
                    : selectedEntity.geometry.radius * 2,
                  unit,
                )}
                onCommit={(v) =>
                  updatePrimitiveGeometry(selectedEntity.id, {
                    radius: unitToMeters(useRadius ? v : v / 2, unit),
                  })
                }
              />

              <details className={styles.advancedDetails}>
                <summary>Opciones avanzadas</summary>
                <div className={styles.advancedBody}>
                  <div className={styles.gridTwo}>
                    <NumberField
                      label="Seg. horiz."
                      step={2}
                      minPositive
                      disabled={isLocked}
                      value={selectedEntity.geometry.widthSegments ?? 32}
                      onCommit={(v) =>
                        updatePrimitiveGeometry(selectedEntity.id, {
                          widthSegments: Math.max(6, Math.min(128, Math.round(v))),
                        })
                      }
                    />
                    <NumberField
                      label="Seg. vert."
                      step={2}
                      minPositive
                      disabled={isLocked}
                      value={selectedEntity.geometry.heightSegments ?? 24}
                      onCommit={(v) =>
                        updatePrimitiveGeometry(selectedEntity.id, {
                          heightSegments: Math.max(4, Math.min(128, Math.round(v))),
                        })
                      }
                    />
                  </div>
                </div>
              </details>
            </>
          )}

          {selectedEntity.type === 'plane' && (
            <div className={styles.gridTwo}>
              <NumberField
                label="Ancho"
                unitSuffix={unit}
                step={step}
                minPositive
                disabled={isLocked}
                value={metersToUnit(selectedEntity.geometry.width, unit)}
                onCommit={(v) =>
                  updatePrimitiveGeometry(selectedEntity.id, {
                    width: unitToMeters(v, unit),
                  })
                }
              />
              <NumberField
                label="Largo"
                unitSuffix={unit}
                step={step}
                minPositive
                disabled={isLocked}
                value={metersToUnit(selectedEntity.geometry.depth, unit)}
                onCommit={(v) =>
                  updatePrimitiveGeometry(selectedEntity.id, {
                    depth: unitToMeters(v, unit),
                  })
                }
              />
            </div>
          )}
        </section>

        {/* Posición y Rotación */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Posición ({unit})</h3>
          <div className={styles.gridThree}>
            <NumberField
              label="X"
              step={step}
              disabled={isLocked}
              value={metersToUnit(selectedEntity.transform.position[0], unit)}
              onCommit={(v) => updatePosAxis(0, v)}
            />
            <NumberField
              label="Y (suelo)"
              step={step}
              disabled={isLocked}
              value={metersToUnit(selectedEntity.transform.position[1], unit)}
              onCommit={(v) => updatePosAxis(1, v)}
            />
            <NumberField
              label="Z"
              step={step}
              disabled={isLocked}
              value={metersToUnit(selectedEntity.transform.position[2], unit)}
              onCommit={(v) => updatePosAxis(2, v)}
            />
          </div>

          <h3 className={styles.sectionTitle}>Rotación (°)</h3>
          <div className={styles.gridThree}>
            <NumberField
              label="Eje X"
              step={5}
              disabled={isLocked}
              value={radiansToDegrees(selectedEntity.transform.rotation[0])}
              onCommit={(v) => updateRotAxis(0, v)}
            />
            <NumberField
              label="Eje Y"
              step={5}
              disabled={isLocked}
              value={radiansToDegrees(selectedEntity.transform.rotation[1])}
              onCommit={(v) => updateRotAxis(1, v)}
            />
            <NumberField
              label="Eje Z"
              step={5}
              disabled={isLocked}
              value={radiansToDegrees(selectedEntity.transform.rotation[2])}
              onCommit={(v) => updateRotAxis(2, v)}
            />
          </div>
        </section>

        {/* Material y apariencia */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Material y acabado</h3>
          {isGroup && (
            <p className={styles.mutedNote}>
              {groupChildCount > 0
                ? 'Aplicar un acabado aquí actualiza en lote todas las piezas hijas.'
                : 'Agrega piezas a este grupo para asignarles un material en lote.'}
            </p>
          )}

          {(!isGroup || groupChildCount > 0) && activeMaterial && (
            <>
              <div className={styles.swatches}>
                {presetMaterials.map((mat) => (
                  <button
                    key={mat.id}
                    type="button"
                    disabled={isLocked}
                    title={mat.name}
                    className={`${styles.swatch} ${!isGroup && activeMaterial.id === mat.id ? styles.swatchActive : ''}`}
                    onClick={() =>
                      assignMaterialToEntity(selectedEntity.id, mat.id)
                    }
                  >
                    <span
                      className={styles.swatchDot}
                      style={{ backgroundColor: mat.color }}
                    />
                    <span>{mat.name}</span>
                  </button>
                ))}
              </div>

              <div className={styles.colorRow}>
                <label className={styles.colorLabel}>
                  <span>Color</span>
                  <div className={styles.colorPickerWrap}>
                    <input
                      type="color"
                      disabled={isLocked}
                      value={activeMaterial.color}
                      onPointerDown={() => beginTransaction()}
                      onPointerUp={() => commitTransaction()}
                      onBlur={() => commitTransaction()}
                      onChange={(e) =>
                        updateEntityMaterialAppearance(selectedEntity.id, {
                          color: e.target.value,
                        })
                      }
                    />
                    <code>{activeMaterial.color.toUpperCase()}</code>
                  </div>
                </label>
              </div>

              <label className={styles.sliderField}>
                <div className={styles.sliderHeader}>
                  <span>Rugosidad</span>
                  <span>{Math.round(activeMaterial.roughness * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  disabled={isLocked}
                  value={activeMaterial.roughness}
                  onPointerDown={() => beginTransaction()}
                  onPointerUp={() => commitTransaction()}
                  onBlur={() => commitTransaction()}
                  onChange={(e) =>
                    updateEntityMaterialAppearance(selectedEntity.id, {
                      roughness: Number(e.target.value),
                    })
                  }
                />
              </label>

              <label className={styles.sliderField}>
                <div className={styles.sliderHeader}>
                  <span>Metalicidad</span>
                  <span>{Math.round(activeMaterial.metalness * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  disabled={isLocked}
                  value={activeMaterial.metalness}
                  onPointerDown={() => beginTransaction()}
                  onPointerUp={() => commitTransaction()}
                  onBlur={() => commitTransaction()}
                  onChange={(e) =>
                    updateEntityMaterialAppearance(selectedEntity.id, {
                      metalness: Number(e.target.value),
                    })
                  }
                />
              </label>
            </>
          )}
        </section>

        {/* Avisos discretos (dimensiones extremas o AABB en grupo) */}
        {activeWarnings.length > 0 && (
          <section className={styles.warningBox} role="status">
            <strong className={styles.warningTitle}>Avisos informativos</strong>
            <ul className={styles.warningList}>
              {activeWarnings.slice(0, 4).map((w, idx) => (
                <li key={`${w.code}-${idx}`}>{w.message}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </aside>
  );
}
