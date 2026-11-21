import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { validateProjectName, type ProjectDocument } from '../../domain';
import {
  downloadProjectJson,
  indexedDbProjectRepository,
  parseProjectJsonFile,
  type ProjectRepository,
  type StoredProjectSummary,
} from '../../persistence';
import { useProjectStore } from '../../store';
import styles from './ProjectsModal.module.css';

interface ProjectsModalProps {
  open: boolean;
  onClose: () => void;
  onNotify?: (message: string) => void;
  repository?: ProjectRepository;
}

type PendingAction =
  | { kind: 'new-empty' }
  | { kind: 'open-saved'; id: string; name: string }
  | { kind: 'import-doc'; doc: ProjectDocument };

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ProjectsModal({
  open,
  onClose,
  onNotify,
  repository = indexedDbProjectRepository,
}: ProjectsModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();
  const errorId = useId();

  const document = useProjectStore((s) => s.document);
  const isDirty = useProjectStore((s) => s.isDirty);
  const updateProjectMeta = useProjectStore((s) => s.updateProjectMeta);
  const markSaved = useProjectStore((s) => s.markSaved);
  const newEmptyProject = useProjectStore((s) => s.newEmptyProject);
  const loadProjectDocument = useProjectStore((s) => s.loadProjectDocument);

  const [nameDraft, setNameDraft] = useState(document.project.name);
  const [descDraft, setDescDraft] = useState(document.project.description);
  const [projects, setProjects] = useState<StoredProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      const list = await repository.listProjects();
      setProjects(list);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el listado local de proyectos.',
      );
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      setNameDraft(document.project.name);
      setDescDraft(document.project.description);
      setError(null);
      setStatusMessage(null);
      setRenamingId(null);
      setConfirmDeleteId(null);
      setPendingAction(null);
      void refreshList();
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fallback for browsers without native <dialog closedby="any">
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

  const handleSaveCurrent = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);

    const validation = validateProjectName(nameDraft);
    if (validation) {
      setError(validation.message);
      return;
    }

    updateProjectMeta({ name: nameDraft.trim(), description: descDraft });
    const latestDoc = useProjectStore.getState().document;

    try {
      await repository.saveProject(latestDoc);
      markSaved();
      await refreshList();
      setStatusMessage(`Proyecto "${latestDoc.project.name}" guardado localmente.`);
      onNotify?.(`Proyecto "${latestDoc.project.name}" guardado en el navegador.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el proyecto en IndexedDB.',
      );
    }
  };

  const executePendingAction = async (action: PendingAction) => {
    setPendingAction(null);
    setError(null);

    switch (action.kind) {
      case 'new-empty': {
        newEmptyProject();
        onNotify?.('Nuevo proyecto vacío listo.');
        dialogRef.current?.close();
        break;
      }
      case 'open-saved': {
        try {
          const loaded = await repository.loadProject(action.id);
          if (!loaded) {
            setError('El proyecto seleccionado ya no se encuentra guardado.');
            await refreshList();
            return;
          }
          loadProjectDocument(loaded, { markDirty: false });
          onNotify?.(`Proyecto "${loaded.project.name}" abierto.`);
          dialogRef.current?.close();
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo abrir el proyecto.',
          );
        }
        break;
      }
      case 'import-doc': {
        loadProjectDocument(action.doc, { markDirty: true });
        onNotify?.(`Archivo "${action.doc.project.name}" importado.`);
        dialogRef.current?.close();
        break;
      }
    }
  };

  const requestOrRunAction = (action: PendingAction) => {
    if (isDirty) {
      setPendingAction(action);
    } else {
      void executePendingAction(action);
    }
  };

  const handleExportJson = () => {
    setError(null);
    const trimmed = nameDraft.trim();
    if (trimmed) {
      updateProjectMeta({ name: trimmed, description: descDraft });
    }
    const latestDoc = useProjectStore.getState().document;
    downloadProjectJson(latestDoc);
    setStatusMessage('Archivo JSON nativo descargado.');
    onNotify?.('Respaldo JSON descargado.');
  };

  const handleImportFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    setStatusMessage(null);
    const result = await parseProjectJsonFile(file);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    requestOrRunAction({ kind: 'import-doc', doc: result.document });
  };

  const handleCommitRename = async (id: string) => {
    setError(null);
    const validation = validateProjectName(renameDraft);
    if (validation) {
      setError(validation.message);
      return;
    }

    const trimmed = renameDraft.trim();
    const ok = await repository.renameProject(id, trimmed);
    if (!ok) {
      setError('No se pudo renombrar el proyecto.');
      return;
    }

    if (id === document.project.id) {
      updateProjectMeta({ name: trimmed });
      setNameDraft(trimmed);
    }
    setRenamingId(null);
    await refreshList();
    setStatusMessage(`Proyecto renombrado a "${trimmed}".`);
  };

  const handleConfirmDelete = async (id: string) => {
    setError(null);
    await repository.deleteProject(id);
    setConfirmDeleteId(null);
    await refreshList();
    setStatusMessage('Proyecto eliminado del almacenamiento local.');
  };

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
            Proyectos y respaldo
          </h2>
          <p className={styles.subtitle}>
            Guardado local en el navegador (IndexedDB) y exportación JSON
            nativa (v1).
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

      <div className={styles.content}>
        {pendingAction && (
          <div className={styles.confirmBar} role="alert">
            <p className={styles.confirmText}>
              Hay cambios sin guardar en <strong>{document.project.name}</strong>.
              ¿Deseas continuar y descartarlos?
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setPendingAction(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={() => void executePendingAction(pendingAction)}
              >
                Descartar y continuar
              </button>
            </div>
          </div>
        )}

        {error && (
          <div id={errorId} className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        {statusMessage && (
          <div className={styles.statusBanner} role="status">
            {statusMessage}
          </div>
        )}

        {/* 1. Guardar proyecto actual */}
        <form className={styles.section} onSubmit={handleSaveCurrent} noValidate>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Proyecto actual</h3>
            {isDirty && (
              <span className={styles.unsavedPill}>Cambios sin guardar</span>
            )}
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Nombre del proyecto</span>
              <input
                type="text"
                value={nameDraft}
                autoFocus
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? errorId : undefined}
                onChange={(e) => setNameDraft(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Descripción (opcional)</span>
              <input
                type="text"
                placeholder="Ej. Escritorio en L con cajonero"
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
              />
            </label>
          </div>

          <div className={styles.buttonRow}>
            <button type="submit" className={styles.primaryBtn}>
              Guardar en navegador
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => requestOrRunAction({ kind: 'new-empty' })}
            >
              Nuevo proyecto vacío
            </button>
          </div>
        </form>

        {/* 2. Respaldo JSON portátil */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Respaldo portátil (.json)</h3>
          <div className={styles.buttonRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={handleExportJson}
            >
              Descargar respaldo .json
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => fileInputRef.current?.click()}
            >
              Importar archivo .json
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className={styles.hiddenInput}
              onChange={handleImportFileChange}
            />
          </div>
        </section>

        {/* 3. Listado de proyectos guardados en IndexedDB */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Guardados en este navegador ({projects.length})
          </h3>

          {loading ? (
            <p className={styles.emptyState}>Cargando proyectos locales...</p>
          ) : projects.length === 0 ? (
            <p className={styles.emptyState}>
              Todavía no tienes proyectos guardados en este navegador. Pulsa{' '}
              <strong>Guardar en navegador</strong> para conservar el actual.
            </p>
          ) : (
            <ul className={styles.projectList}>
              {projects.map((item) => {
                const isCurrent = item.id === document.project.id;
                const isRenaming = renamingId === item.id;
                const isDeleting = confirmDeleteId === item.id;

                return (
                  <li
                    key={item.id}
                    className={`${styles.projectRow} ${isCurrent ? styles.projectRowActive : ''}`}
                  >
                    {isRenaming ? (
                      <div className={styles.renameRow}>
                        <input
                          type="text"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              void handleCommitRename(item.id);
                            } else if (e.key === 'Escape') {
                              setRenamingId(null);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className={styles.primarySmallBtn}
                          onClick={() => void handleCommitRename(item.id)}
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          className={styles.smallBtn}
                          onClick={() => setRenamingId(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className={styles.projectInfo}>
                          <div className={styles.projectTitleLine}>
                            <strong>{item.name}</strong>
                            {isCurrent && (
                              <span className={styles.activeBadge}>Activo</span>
                            )}
                          </div>
                          {item.description && (
                            <span className={styles.projectDesc}>
                              {item.description}
                            </span>
                          )}
                          <span className={styles.projectMeta}>
                            {item.entityCount}{' '}
                            {item.entityCount === 1 ? 'pieza' : 'piezas'} ·{' '}
                            {item.displayUnit} · {formatDate(item.updatedAt)}
                          </span>
                        </div>

                        <div className={styles.projectActions}>
                          {isDeleting ? (
                            <>
                              <button
                                type="button"
                                className={styles.dangerSmallBtn}
                                onClick={() => void handleConfirmDelete(item.id)}
                              >
                                Confirmar
                              </button>
                              <button
                                type="button"
                                className={styles.smallBtn}
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className={styles.smallBtn}
                                onClick={() =>
                                  requestOrRunAction({
                                    kind: 'open-saved',
                                    id: item.id,
                                    name: item.name,
                                  })
                                }
                              >
                                Abrir
                              </button>
                              <button
                                type="button"
                                className={styles.smallBtn}
                                onClick={() => {
                                  setConfirmDeleteId(null);
                                  setRenamingId(item.id);
                                  setRenameDraft(item.name);
                                }}
                              >
                                Renombrar
                              </button>
                              <button
                                type="button"
                                className={styles.smallDangerOutlineBtn}
                                onClick={() => {
                                  setRenamingId(null);
                                  setConfirmDeleteId(item.id);
                                }}
                              >
                                Eliminar
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </dialog>
  );
}
