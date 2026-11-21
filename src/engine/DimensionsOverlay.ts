import * as THREE from 'three';
import {
  formatLength,
  type AABB,
  type DisplayUnit,
  type Vec3,
} from '../domain';

const LINE_COLOR = 0x57534b;
const EXTENSION_LINE_COLOR = 0x8e887d;

function makeSignature(
  visible: boolean,
  aabb: AABB | null,
  unit: DisplayUnit,
): string {
  if (!visible || !aabb) return 'hidden';
  return `${unit}:${aabb.min.join(',')}:${aabb.max.join(',')}`;
}

export class DimensionsOverlay {
  readonly group: THREE.Group;

  private readonly mainLineMaterial: THREE.LineBasicMaterial;
  private readonly extLineMaterial: THREE.LineBasicMaterial;
  private lastSignature = '';

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'DimensionsOverlay';
    scene.add(this.group);

    this.mainLineMaterial = new THREE.LineBasicMaterial({
      color: LINE_COLOR,
      transparent: true,
      opacity: 0.9,
    });
    this.extLineMaterial = new THREE.LineBasicMaterial({
      color: EXTENSION_LINE_COLOR,
      transparent: true,
      opacity: 0.55,
    });
  }

  sync(visible: boolean, aabb: AABB | null, unit: DisplayUnit): void {
    const signature = makeSignature(visible, aabb, unit);
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;

    this.clearChildren();
    if (!visible || !aabb) {
      this.group.visible = false;
      return;
    }

    this.group.visible = true;
    this.buildDimensionsForAABB(aabb, unit);
  }

  private buildDimensionsForAABB(aabb: AABB, unit: DisplayUnit): void {
    const [minX, minY, minZ] = aabb.min;
    const [maxX, maxY, maxZ] = aabb.max;
    const width = maxX - minX;
    const height = maxY - minY;
    const depth = maxZ - minZ;

    const maxSpan = Math.max(width, height, depth, 0.25);
    const offset = Math.max(0.14, Math.min(0.42, maxSpan * 0.13));
    const tick = Math.max(0.026, Math.min(0.06, maxSpan * 0.028));
    const labelScale = Math.max(0.32, Math.min(0.66, maxSpan * 0.24));
    const baseY = Math.max(0.015, minY + 0.01);

    // 1. Width (X axis) along front (+Z) exterior
    if (width > 0.0005) {
      const zLine = maxZ + offset;
      this.addLine(
        [
          [minX, baseY, maxZ],
          [minX, baseY, zLine + tick * 0.6],
        ],
        this.extLineMaterial,
      );
      this.addLine(
        [
          [maxX, baseY, maxZ],
          [maxX, baseY, zLine + tick * 0.6],
        ],
        this.extLineMaterial,
      );
      this.addLine(
        [
          [minX, baseY, zLine],
          [maxX, baseY, zLine],
        ],
        this.mainLineMaterial,
      );
      // Ticks
      this.addLine(
        [
          [minX, baseY, zLine - tick],
          [minX, baseY, zLine + tick],
        ],
        this.mainLineMaterial,
      );
      this.addLine(
        [
          [maxX, baseY, zLine - tick],
          [maxX, baseY, zLine + tick],
        ],
        this.mainLineMaterial,
      );
      this.addLabel(
        formatLength(width, unit),
        [(minX + maxX) / 2, baseY + tick * 1.4, zLine + tick * 0.7],
        labelScale,
      );
    }

    // 2. Depth (Z axis) along left (-X) exterior
    if (depth > 0.0005) {
      const xLine = minX - offset;
      this.addLine(
        [
          [minX, baseY, minZ],
          [xLine - tick * 0.6, baseY, minZ],
        ],
        this.extLineMaterial,
      );
      this.addLine(
        [
          [minX, baseY, maxZ],
          [xLine - tick * 0.6, baseY, maxZ],
        ],
        this.extLineMaterial,
      );
      this.addLine(
        [
          [xLine, baseY, minZ],
          [xLine, baseY, maxZ],
        ],
        this.mainLineMaterial,
      );
      // Ticks
      this.addLine(
        [
          [xLine - tick, baseY, minZ],
          [xLine + tick, baseY, minZ],
        ],
        this.mainLineMaterial,
      );
      this.addLine(
        [
          [xLine - tick, baseY, maxZ],
          [xLine + tick, baseY, maxZ],
        ],
        this.mainLineMaterial,
      );
      this.addLabel(
        formatLength(depth, unit),
        [xLine - tick * 0.7, baseY + tick * 1.4, (minZ + maxZ) / 2],
        labelScale,
      );
    }

    // 3. Height (Y axis) along right (+X) exterior
    if (height > 0.0005) {
      const xLine = maxX + offset;
      const zCenter = (minZ + maxZ) / 2;
      this.addLine(
        [
          [maxX, minY, zCenter],
          [xLine + tick * 0.6, minY, zCenter],
        ],
        this.extLineMaterial,
      );
      this.addLine(
        [
          [maxX, maxY, zCenter],
          [xLine + tick * 0.6, maxY, zCenter],
        ],
        this.extLineMaterial,
      );
      this.addLine(
        [
          [xLine, minY, zCenter],
          [xLine, maxY, zCenter],
        ],
        this.mainLineMaterial,
      );
      // Ticks
      this.addLine(
        [
          [xLine - tick, minY, zCenter],
          [xLine + tick, minY, zCenter],
        ],
        this.mainLineMaterial,
      );
      this.addLine(
        [
          [xLine - tick, maxY, zCenter],
          [xLine + tick, maxY, zCenter],
        ],
        this.mainLineMaterial,
      );
      this.addLabel(
        formatLength(height, unit),
        [xLine + tick * 1.4, (minY + maxY) / 2, zCenter],
        labelScale,
      );
    }
  }

  private addLine(points: [Vec3, Vec3], material: THREE.LineBasicMaterial): void {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...points[0]),
      new THREE.Vector3(...points[1]),
    ]);
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 25;
    this.group.add(line);
  }

  private addLabel(text: string, pos: Vec3, scaleX: number): void {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 68;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.strokeStyle = '#a9a194';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(4, 4, 248, 60, 14);
    } else {
      ctx.rect(4, 4, 248, 60);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#292722';
    ctx.font = '700 26px Inter, Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 35);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(pos[0], pos[1], pos[2]);
    sprite.scale.set(scaleX, scaleX * (68 / 256), 1);
    sprite.renderOrder = 30;
    this.group.add(sprite);
  }

  private clearChildren(): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[this.group.children.length - 1];
      child.removeFromParent();

      if (child instanceof THREE.Line) {
        child.geometry.dispose();
      } else if (child instanceof THREE.Sprite) {
        child.material.map?.dispose();
        child.material.dispose();
      }
    }
  }

  dispose(): void {
    this.clearChildren();
    this.mainLineMaterial.dispose();
    this.extLineMaterial.dispose();
    this.group.removeFromParent();
  }
}
