import { useMemo } from 'react';
import {
  PRIMITIVE_LABELS,
  aabbToDimensions,
  formatLength,
  getDescendantPrimitives,
  getEntityWorldAABB,
  getProjectWorldAABB,
  isGroupEntity,
  isPrimitiveEntity,
} from '../../domain';
import { useProjectStore } from '../../store';
import styles from './SummaryCard.module.css';

export function SummaryCard() {
  const project = useProjectStore((s) => s.document.project);
  const settings = useProjectStore((s) => s.document.settings);
  const entities = useProjectStore((s) => s.document.entities);
  const selectedId = useProjectStore((s) => s.selectedId);

  const selectedEntity = useMemo(
    () => entities.find((e) => e.id === selectedId) ?? null,
    [entities, selectedId],
  );

  const unit = project.displayUnit;

  const summary = useMemo(() => {
    if (selectedEntity) {
      if (isPrimitiveEntity(selectedEntity)) {
        const specs: Array<{ label: string; value: string }> = [];
        switch (selectedEntity.type) {
          case 'box':
            specs.push(
              { label: 'Ancho', value: formatLength(selectedEntity.geometry.width, unit) },
              { label: 'Alto', value: formatLength(selectedEntity.geometry.height, unit) },
              { label: 'Profundidad', value: formatLength(selectedEntity.geometry.depth, unit) },
              { label: 'Base (Y)', value: formatLength(selectedEntity.transform.position[1], unit) },
            );
            break;
          case 'cylinder':
            specs.push(
              { label: 'Diámetro', value: formatLength(selectedEntity.geometry.radius * 2, unit) },
              { label: 'Alto', value: formatLength(selectedEntity.geometry.height, unit) },
              { label: 'Radio', value: formatLength(selectedEntity.geometry.radius, unit) },
              { label: 'Base (Y)', value: formatLength(selectedEntity.transform.position[1], unit) },
            );
            break;
          case 'sphere':
            specs.push(
              { label: 'Diámetro', value: formatLength(selectedEntity.geometry.radius * 2, unit) },
              { label: 'Radio', value: formatLength(selectedEntity.geometry.radius, unit) },
              { label: 'Base (Y)', value: formatLength(selectedEntity.transform.position[1], unit) },
            );
            break;
          case 'plane':
            specs.push(
              { label: 'Ancho', value: formatLength(selectedEntity.geometry.width, unit) },
              { label: 'Largo', value: formatLength(selectedEntity.geometry.depth, unit) },
              { label: 'Altura (Y)', value: formatLength(selectedEntity.transform.position[1], unit) },
            );
            break;
        }

        return {
          title: selectedEntity.name,
          subtitle: `${PRIMITIVE_LABELS[selectedEntity.type]} · ${selectedEntity.layer === 'accessories' ? 'Accesorios' : 'Principal'}`,
          specs,
        };
      }

      if (isGroupEntity(selectedEntity)) {
        const children = getDescendantPrimitives(selectedEntity.id, entities);
        const aabb = getEntityWorldAABB(selectedEntity.id, entities, {
          includeHidden: false,
          showAccessories: settings.showAccessories,
        });
        const dims = aabb ? aabbToDimensions(aabb) : null;
        return {
          title: selectedEntity.name,
          subtitle: `Grupo · ${children.length} ${children.length === 1 ? 'pieza' : 'piezas'}`,
          specs: dims
            ? [
                { label: 'Ancho total', value: formatLength(dims.width, unit) },
                { label: 'Alto total', value: formatLength(dims.height, unit) },
                { label: 'Profundidad', value: formatLength(dims.depth, unit) },
                { label: 'Capa', value: selectedEntity.layer === 'accessories' ? 'Accesorios' : 'Principal' },
              ]
            : [{ label: 'Estado', value: 'Grupo vacío' }],
        };
      }
    }

    const primitiveCount = entities.filter(isPrimitiveEntity).length;
    const projectAABB = getProjectWorldAABB(entities, {
      includeHidden: false,
      showAccessories: settings.showAccessories,
    });
    const dims = projectAABB ? aabbToDimensions(projectAABB) : null;

    return {
      title: project.name,
      subtitle:
        project.description.trim() ||
        (primitiveCount === 0
          ? 'Lienzo vacío a escala real'
          : `${primitiveCount} ${primitiveCount === 1 ? 'pieza' : 'piezas'} · Unidad: ${unit}`),
      specs: dims
        ? [
            { label: 'Ancho total', value: formatLength(dims.width, unit) },
            { label: 'Alto total', value: formatLength(dims.height, unit) },
            { label: 'Profundidad', value: formatLength(dims.depth, unit) },
            { label: 'Unidad activa', value: unit },
          ]
        : [],
    };
  }, [selectedEntity, entities, project, settings.showAccessories, unit]);

  if (!settings.showSummaryCard) {
    return null;
  }

  return (
    <section className={styles.card} aria-label="Ficha resumen de medidas">
      <h1 className={styles.title}>{summary.title}</h1>
      <p className={styles.subtitle}>{summary.subtitle}</p>
      {summary.specs.length > 0 && (
        <div className={styles.specs}>
          {summary.specs.map((spec) => (
            <div key={spec.label} className={styles.specItem}>
              <span className={styles.specLabel}>{spec.label}</span>
              <strong className={styles.specValue}>{spec.value}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
