import { useEffect, useRef, type DragEvent } from 'react';
import { SceneController } from '../../engine';
import { QUICK_OBJECT_DRAG_MIME } from '../left-panel/LeftPanel';
import styles from './ViewportCanvas.module.css';

interface ViewportCanvasProps {
  activeDragPresetId: string | null;
  onDragEndReset?: () => void;
  onControllerReady?: (controller: SceneController | null) => void;
}

export function ViewportCanvas({
  activeDragPresetId,
  onDragEndReset,
  onControllerReady,
}: ViewportCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SceneController | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const controller = new SceneController(container);
    controllerRef.current = controller;
    onControllerReady?.(controller);

    return () => {
      controllerRef.current = null;
      onControllerReady?.(null);
      controller.dispose();
    };
  }, [onControllerReady]);

  useEffect(() => {
    if (!activeDragPresetId) {
      controllerRef.current?.clearDragPreview();
    }
  }, [activeDragPresetId]);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!activeDragPresetId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    controllerRef.current?.updateDragPreview(
      activeDragPresetId,
      event.clientX,
      event.clientY,
    );
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    controllerRef.current?.clearDragPreview();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const presetId =
      event.dataTransfer.getData(QUICK_OBJECT_DRAG_MIME) ||
      event.dataTransfer.getData('text/plain') ||
      activeDragPresetId;
    if (!presetId) return;

    event.preventDefault();
    controllerRef.current?.commitDragDrop(
      presetId,
      event.clientX,
      event.clientY,
    );
    onDragEndReset?.();
  };

  return (
    <div
      ref={containerRef}
      className={styles.canvasHost}
      aria-label="Lienzo 3D interactivo"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    />
  );
}
