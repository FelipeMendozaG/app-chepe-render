import { useCallback, useEffect, useRef, useState } from 'react';
import { useProjectStore } from './store';
import { TopBar } from './ui/topbar/TopBar';
import { LeftPanel } from './ui/left-panel/LeftPanel';
import { ViewportCanvas } from './ui/viewport/ViewportCanvas';
import { ViewportOverlay } from './ui/viewport/ViewportOverlay';
import { RightPanel } from './ui/right-panel/RightPanel';
import { NewPieceModal } from './ui/modals/NewPieceModal';
import { ProjectsModal } from './ui/modals/ProjectsModal';
import styles from './App.module.css';

export function App() {
  const isDirty = useProjectStore((s) => s.isDirty);

  const [newPieceOpen, setNewPieceOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [activeDragPresetId, setActiveDragPresetId] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  // Protect user against accidentally closing tab/reloading with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return (
    <div className={styles.shell}>
      <TopBar
        onOpenNewPiece={() => setNewPieceOpen(true)}
        onOpenProjects={() => setProjectsOpen(true)}
      />

      <div className={styles.workspace}>
        <LeftPanel
          onPresetDragStart={(presetId) => setActiveDragPresetId(presetId)}
          onPresetDragEnd={() => setActiveDragPresetId(null)}
        />

        <main className={styles.viewport} aria-label="Escena 3D">
          <ViewportCanvas
            activeDragPresetId={activeDragPresetId}
            onDragEndReset={() => setActiveDragPresetId(null)}
          />
          <ViewportOverlay />
          {notice && (
            <div className={styles.toast} role="status">
              {notice}
            </div>
          )}
        </main>

        <RightPanel />
      </div>

      <NewPieceModal
        open={newPieceOpen}
        onClose={() => setNewPieceOpen(false)}
      />

      <ProjectsModal
        open={projectsOpen}
        onClose={() => setProjectsOpen(false)}
        onNotify={showNotice}
      />
    </div>
  );
}
