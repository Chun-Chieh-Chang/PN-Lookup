import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ForceGraph3D, { ForceGraphMethods } from 'react-force-graph-3d';
import * as THREE from 'three';
import {
  ArrowLeft,
  Search,
  X,
  RotateCcw,
  Info,
  Layers,
  ExternalLink,
  Sparkles,
  Eye,
  EyeOff,
  Play,
  Pause,
  ChevronRight,
  FolderTree,
  ChevronsDown,
  ChevronsUp,
} from 'lucide-react';
import { PartItem } from '../types';
import { MindMapNode, buildMindMapTree } from '../utils/mindMapTree';
import { ImageLibrary } from '../utils/imageLibrary';
import { resolveImage } from '../utils/imageResolver';
import { APP_VERSION } from '../version';

// ────────────────────────────────────────────────────────────────────────────
// Constants & Color Palette
// ────────────────────────────────────────────────────────────────────────────

const NODE_REL_SIZE = 3.4;
const PART_R = 2.4;
const DIM_NODE_COLOR = 'rgba(15,23,42,0.22)';
const DIM_LINK_COLOR = 'rgba(51,65,85,0.12)';
const MATCH_COLOR = '#FBBF24';
const SELECTED_COLOR = '#38BDF8';
const LINK_COLOR = 'rgba(148,163,184,0.35)';
const LINK_ACTIVE_COLOR = '#38BDF8';

function getLinkId(nodeOrId: string | MM3DNode | { id?: string | number } | undefined): string {
  if (!nodeOrId) return '';
  if (typeof nodeOrId === 'object' && nodeOrId !== null) {
    return String((nodeOrId as { id?: string | number }).id ?? '');
  }
  return String(nodeOrId);
}

const LAYER_RADIUS = [0, 68, 138, 208, 272, 332];
const R_BY_DEPTH: Record<number, number> = { 0: 10.5, 1: 7.2, 2: 5.2, 3: 4.4, 4: 3.6, 5: 3.0 };

// 3 大主分支空間向量（立體花瓣向度）
const BRANCH_DIRS: THREE.Vector3[] = [
  new THREE.Vector3(0.32, -0.22, 0.92),   // 廠內品號
  new THREE.Vector3(-0.82, 0.30, 0.48),   // 客戶品號
  new THREE.Vector3(0.42, 0.88, -0.22),   // 待人工分類
].map((v) => v.clone().normalize());

const HALF_BY_CHILD_KIND: Record<string, number> = {
  root: 0,
  branch: 0.65,
  category: 0.52,
  subcategory: 0.45,
  part: 0.48,
};

function tint(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const num = parseInt(h, 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + amt);
  const g = Math.min(255, ((num >> 8) & 0xff) + amt);
  const b = Math.min(255, (num & 0xff) + amt);
  const rr = Math.min(255, Math.max(0, r)).toString(16).padStart(2, '0');
  const gg = Math.min(255, Math.max(0, g)).toString(16).padStart(2, '0');
  const bb = Math.min(255, Math.max(0, b)).toString(16).padStart(2, '0');
  return `#${rr}${gg}${bb}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Sprite 紋理快取（光暈 + 節點文字標籤）
// ────────────────────────────────────────────────────────────────────────────

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const GLOW_TEXTURE_CACHE = new Map<string, THREE.CanvasTexture>();

function glowTexture(color: string): THREE.CanvasTexture {
  const cached = GLOW_TEXTURE_CACHE.get(color);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(0.35, color + '66');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  GLOW_TEXTURE_CACHE.set(color, tex);
  return tex;
}

const LABEL_CACHE = new Map<string, THREE.CanvasTexture>();

function labelTexture(text: string, color: string): THREE.CanvasTexture {
  const key = `${text}|${color}`;
  const cached = LABEL_CACHE.get(key);
  if (cached) return cached;

  const scale = 3; // 3x 高解析度 Retina 渲染，徹底消除 3D 空間字體模糊
  const fontSize = 15 * scale; // 45px
  const font = `bold ${fontSize}px "JetBrains Mono", Consolas, "PingFang TC", "Microsoft JhengHei", sans-serif`;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;

  let shown = text;
  let tw = Math.ceil(ctx.measureText(shown).width);
  const maxW = 300 * scale;
  while (tw > maxW && shown.length > 6) {
    shown = shown.slice(0, shown.length - 2) + '…';
    tw = Math.ceil(ctx.measureText(shown).width);
  }

  const padX = 12 * scale;
  const padY = 6 * scale;
  const w = Math.max(tw + padX * 2, 40 * scale);
  const h = fontSize + padY * 2;
  canvas.width = w;
  canvas.height = h;

  const c2 = canvas.getContext('2d')!;
  c2.font = font;

  // 1. 高對比暗黑背景（半透明深 Slate 900 膠囊）
  c2.fillStyle = 'rgba(11, 18, 32, 0.94)';
  roundedRect(c2, 0, 0, w, h, 7 * scale);
  c2.fill();

  // 2. 節點分類專屬色彩外框 (Glowing Border)
  c2.strokeStyle = color || '#38BDF8';
  c2.lineWidth = 2.2 * scale;
  c2.lineJoin = 'round';
  roundedRect(c2, 1.2 * scale, 1.2 * scale, w - 2.4 * scale, h - 2.4 * scale, 6 * scale);
  c2.stroke();

  // 3. 極致清晰白色標題文字
  c2.fillStyle = '#FFFFFF';
  c2.textBaseline = 'middle';
  c2.fillText(shown, padX, h / 2 + 1 * scale);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  LABEL_CACHE.set(key, tex);
  return tex;
}

// ────────────────────────────────────────────────────────────────────────────
// 資料型別定義
// ────────────────────────────────────────────────────────────────────────────

export interface MM3DNode {
  id: string;
  label: string;
  sublabel?: string;
  kind: 'root' | 'branch' | 'category' | 'subcategory' | 'part';
  depth: number;
  color: string;
  textColor: string;
  r: number;
  parts: PartItem[];
  category?: string;
  part?: PartItem;
  parentId?: string;
  childIds: string[];
  x: number;
  y: number;
  z: number;
  fx: number;
  fy: number;
  fz: number;
  _valBase: number;
  _val: number;
  _color: string;
}

export interface MM3DLink {
  id: string;
  source: string;
  target: string;
  _color: string;
}

interface MindMap3DGraph {
  nodes: MM3DNode[];
  links: MM3DLink[];
  byId: Map<string, MM3DNode>;
  adjacency: Map<string, Set<string>>;
  parentOf: Map<string, string | undefined>;
  childrenOf: Map<string, string[]>;
}

function orthoBasis(u: THREE.Vector3): { v: THREE.Vector3; w: THREE.Vector3 } {
  const ref = Math.abs(u.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const v = new THREE.Vector3().crossVectors(ref, u).normalize();
  const w = new THREE.Vector3().crossVectors(u, v).normalize();
  return { v, w };
}

function spreadDirs(parentDir: THREE.Vector3, half: number, k: number): THREE.Vector3[] {
  if (k <= 0) return [];
  if (k === 1) return [parentDir.clone().normalize()];
  const { v, w } = orthoBasis(parentDir.clone().normalize());
  const u = parentDir.clone().normalize();
  const dirs: THREE.Vector3[] = [];
  for (let i = 0; i < k; i++) {
    const az = (i / k) * Math.PI * 2;
    dirs.push(
      new THREE.Vector3()
        .addScaledVector(u, Math.cos(half))
        .addScaledVector(v, Math.sin(half) * Math.cos(az))
        .addScaledVector(w, Math.sin(half) * Math.sin(az))
        .normalize(),
    );
  }
  return dirs;
}

function buildMindMap3DGraph(tree: MindMapNode): MindMap3DGraph {
  const nodes: MM3DNode[] = [];
  const links: MM3DLink[] = [];
  const byId = new Map<string, MM3DNode>();
  const parentOf = new Map<string, string | undefined>();
  const childrenOf = new Map<string, string[]>();
  let linkCounter = 0;

  const childHalfAngle = (parentKind: string, k: number): number => {
    if (k <= 0) return 0;
    const base = HALF_BY_CHILD_KIND[parentKind] ?? 0.45;
    const scale = Math.min(1.5, 0.6 + Math.log2(Math.max(2, k + 1)) / 1.8);
    return base * scale;
  };

  const mmKind = (depth: number): MM3DNode['kind'] => {
    if (depth === 0) return 'root';
    if (depth === 1) return 'branch';
    if (depth === 2) return 'category';
    return 'subcategory';
  };

  const makeNode = (
    mm: MindMapNode,
    kind: MM3DNode['kind'],
    parentId: string | undefined,
    dir: THREE.Vector3 | null,
  ): MM3DNode => {
    const depth = mm.depth;
    const radius = depth === 0 ? 0 : LAYER_RADIUS[Math.min(depth, LAYER_RADIUS.length - 1)];
    const r = depth === 0 ? R_BY_DEPTH[0] : R_BY_DEPTH[Math.min(depth, 5)] ?? 3.2;
    const node: MM3DNode = {
      id: mm.id,
      label: mm.label,
      sublabel: mm.sublabel,
      kind,
      depth,
      color: mm.borderColor,
      textColor: mm.textColor,
      r,
      parts: mm.parts ?? [],
      category: mm.category,
      part: undefined,
      parentId,
      childIds: [],
      x: 0, y: 0, z: 0,
      fx: 0, fy: 0, fz: 0,
      _valBase: (r / NODE_REL_SIZE) ** 3,
      _val: (r / NODE_REL_SIZE) ** 3,
      _color: mm.borderColor,
    };
    if (dir && radius > 0) {
      const d = dir.clone().normalize();
      node.x = node.fx = d.x * radius;
      node.y = node.fy = d.y * radius;
      node.z = node.fz = d.z * radius;
    }
    nodes.push(node);
    byId.set(mm.id, node);
    if (!childrenOf.has(mm.id)) childrenOf.set(mm.id, []);
    if (parentId) {
      parentOf.set(mm.id, parentId);
      if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
      childrenOf.get(parentId)!.push(mm.id);
      links.push({ id: `l${linkCounter++}`, source: parentId, target: mm.id, _color: LINK_COLOR });
    }
    return node;
  };

  const walk = (mm: MindMapNode, kind: MM3DNode['kind'], parentId: string | undefined, dir: THREE.Vector3 | null) => {
    const node = makeNode(mm, kind, parentId, dir);

    // 樹狀子分類節點
    if (mm.children && mm.children.length > 0) {
      let childDirs: THREE.Vector3[];
      if (mm.depth === 0) {
        childDirs = mm.children.map((_, i) => BRANCH_DIRS[i % BRANCH_DIRS.length].clone().normalize());
      } else {
        const half = childHalfAngle(node.kind, mm.children.length);
        childDirs = spreadDirs(dir ?? new THREE.Vector3(0, 0, 1), half, mm.children.length);
        const azOffset = (mm.depth + 1) * 0.6;
        const axis = (dir ?? new THREE.Vector3(0, 0, 1)).clone().normalize();
        const rot = new THREE.Matrix4().makeRotationAxis(axis, azOffset);
        childDirs = childDirs.map((d) => d.clone().applyMatrix4(rot).normalize());
      }
      mm.children.forEach((c, i) => {
        const childKind = mmKind(c.depth);
        walk(c, childKind, mm.id, childDirs[i] ?? childDirs[0]);
      });
    }

    // 品號葉節點 (Part Items)
    if (mm.parts && mm.parts.length > 0) {
      const half = childHalfAngle('part', mm.parts.length);
      let dirs = spreadDirs(dir ?? new THREE.Vector3(0, 0, -1), half, mm.parts.length);
      const baseAz = mm.depth * 0.6;
      const axis = (dir ?? new THREE.Vector3(0, 0, 1)).clone().normalize();
      const rot = new THREE.Matrix4().makeRotationAxis(axis, baseAz);
      dirs = dirs.map((d) => d.clone().applyMatrix4(rot).normalize());
      const baseDir = dir ?? new THREE.Vector3(0, 0, -1);
      const pdepth = mm.depth + 1;

      mm.parts.forEach((p, i) => {
        const d = dirs[i] ?? baseDir;
        const pradius = LAYER_RADIUS[Math.min(pdepth, LAYER_RADIUS.length - 1)];
        const pr = PART_R;
        const pnodeId = `part:${p.partNo}`;
        const pnode: MM3DNode = {
          id: pnodeId,
          label: p.partNo,
          sublabel: p.name,
          kind: 'part',
          depth: pdepth,
          color: tint(mm.borderColor, 45),
          textColor: mm.textColor,
          r: pr,
          parts: [],
          category: mm.category,
          part: p,
          parentId: mm.id,
          childIds: [],
          x: d.x * pradius,
          y: d.y * pradius,
          z: d.z * pradius,
          fx: d.x * pradius,
          fy: d.y * pradius,
          fz: d.z * pradius,
          _valBase: (pr / NODE_REL_SIZE) ** 3,
          _val: (pr / NODE_REL_SIZE) ** 3,
          _color: tint(mm.borderColor, 45),
        };
        nodes.push(pnode);
        byId.set(pnode.id, pnode);
        parentOf.set(pnode.id, mm.id);
        if (!childrenOf.has(mm.id)) childrenOf.set(mm.id, []);
        childrenOf.get(mm.id)!.push(pnode.id);
        links.push({ id: `l${linkCounter++}`, source: mm.id, target: pnode.id, _color: LINK_COLOR });
      });
    }
  };

  walk(tree, 'root', undefined, null);

  // 整理每個節點的 childIds
  for (const n of nodes) {
    n.childIds = childrenOf.get(n.id) ?? [];
  }

  // 雙向鄰接表
  const adjacency = new Map<string, Set<string>>();
  for (const n of nodes) adjacency.set(n.id, new Set());
  for (const l of links) {
    adjacency.get(l.source)?.add(l.target);
    adjacency.get(l.target)?.add(l.source);
  }

  return { nodes, links, byId, adjacency, parentOf, childrenOf };
}

function nodeExtendObject(node: MM3DNode): THREE.Group {
  const group = new THREE.Group();
  const color = node.color;
  const baseR = node.r;

  // 1. 節點底部呼吸光暈
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(color),
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      depthTest: false,
    }),
  );
  glow.scale.set(baseR * 6.5, baseR * 6.5, 1);
  glow.raycast = () => {};
  group.add(glow);

  // 2. 節點常駐高解析度文字名稱標籤（Billboard Sprite）
  const tex = labelTexture(node.label, color);
  const aspect = tex.image.width / tex.image.height;
  const worldH = Math.max(6.0, baseR * 0.95 + 4.5);
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      depthTest: false, // 確保名稱標籤永遠懸浮於頂層，不被其他節點或幾何體遮擋
    }),
  );
  label.scale.set(worldH * aspect, worldH, 1);
  label.position.y = baseR + worldH * 0.55 + 1.2;
  label.renderOrder = 999; // 最高渲染順序
  label.raycast = () => {};
  group.add(label);

  return group;
}

// ────────────────────────────────────────────────────────────────────────────
// Component Props
// ────────────────────────────────────────────────────────────────────────────

interface ProductMindMap3DModalProps {
  isOpen: boolean;
  onClose: () => void;
  parts: PartItem[];
  imageLib?: ImageLibrary | null;
  bindings?: Record<string, string>;
  ocrIndex?: Map<string, string>;
  onSelectPart?: (partNo: string) => void;
}

export const ProductMindMap3DModal: React.FC<ProductMindMap3DModalProps> = ({
  isOpen,
  onClose,
  parts,
  imageLib = null,
  bindings = {},
  ocrIndex = new Map(),
  onSelectPart,
}) => {
  const graphRef = useRef<ForceGraphMethods<MM3DNode, MM3DLink> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const didInitialZoom = useRef(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [matchIds, setMatchIds] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<MM3DNode | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [labelsOn, setLabelsOn] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [, setVizTick] = useState(0);

  // 展開節點 ID 集合（支援動態按需展開/收合層級）
  // 預設僅開展單一主體系（廠內品號編碼），保持視野極致簡潔清晰
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(['root', 'factory']),
  );

  // 原始樹與 3D 圖資料
  const tree = useMemo(() => buildMindMapTree(parts), [parts]);
  const fullGraph = useMemo(() => buildMindMap3DGraph(tree), [tree]);
  const { nodes: fullNodes, links: fullLinks, byId, parentOf, childrenOf, adjacency } = fullGraph;

  // 初始化各節點之視覺屬性
  useMemo(() => {
    for (const n of fullNodes) {
      n._valBase = (n.r / NODE_REL_SIZE) ** 3;
      n._val = n._valBase;
      n._color = n.color;
    }
    for (const l of fullLinks) {
      l._color = LINK_COLOR;
    }
  }, [fullNodes, fullLinks]);

  // 動態過濾可見節點與連線（依據 expandedIds，三大體系僅在「開」的狀態時顯示節點與訊息文字）
  const graphData = useMemo(() => {
    const isVisible = (id: string): boolean => {
      if (id === 'root') return true;
      const pid = parentOf.get(id);
      if (!pid) return false;
      if (pid === 'root') {
        // 第一層三大體系節點：唯有在 expandedIds (即「開」的狀態) 時才顯示節點與文字
        return expandedIds.has(id);
      }
      return expandedIds.has(pid) && isVisible(pid);
    };

    const visibleNodeIds = new Set<string>();
    for (const n of fullNodes) {
      if (isVisible(n.id)) visibleNodeIds.add(n.id);
    }

    const nodes = fullNodes.filter((n) => visibleNodeIds.has(n.id));
    const links = fullLinks
      .filter((l) => {
        const s = getLinkId(l.source);
        const t = getLinkId(l.target);
        return visibleNodeIds.has(s) && visibleNodeIds.has(t);
      })
      .map((l) => ({
        id: l.id,
        source: getLinkId(l.source),
        target: getLinkId(l.target),
        _color: l._color,
      }));
    return { nodes, links };
  }, [expandedIds, fullLinks, fullNodes, parentOf]);

  // 套用視覺高亮狀態（Mutate _val / _color，零物件重建）
  const applyVisual = useCallback(
    (focusId: string | null, mode: 'hover' | 'selected' | 'matched', matches: Set<string>) => {
      const relevant = new Set<string>();
      if (focusId) {
        relevant.add(focusId);
        for (const nb of adjacency.get(focusId) ?? []) relevant.add(nb);
      }
      for (const m of matches) {
        relevant.add(m);
        for (const nb of adjacency.get(m) ?? []) relevant.add(nb);
      }
      const active = relevant.size > 0;

      for (const n of fullNodes) {
        const base = n._valBase ?? (n.r / NODE_REL_SIZE) ** 3;
        if (!active) {
          n._val = base;
          n._color = n.color;
          continue;
        }
        if (focusId && n.id === focusId) {
          n._val = base * (mode === 'selected' ? 6.5 : 3.8);
          n._color = mode === 'matched' ? MATCH_COLOR : SELECTED_COLOR;
          continue;
        }
        if (matches.has(n.id)) {
          n._val = base * 5.2;
          n._color = MATCH_COLOR;
          continue;
        }
        if (relevant.has(n.id)) {
          n._val = base * 1.35;
          n._color = n.color;
          continue;
        }
        n._val = base * 0.35;
        n._color = DIM_NODE_COLOR;
      }

      for (const l of fullLinks) {
        const s = getLinkId(l.source);
        const t = getLinkId(l.target);
        const isRel = relevant.has(s) && relevant.has(t);
        l._color = !active ? LINK_COLOR : isRel ? LINK_ACTIVE_COLOR : DIM_LINK_COLOR;
      }

      setVizTick((t) => t + 1);
    },
    [adjacency, fullLinks, fullNodes],
  );

  // 取得某節點之所有子孫節點集合 (用於階層遞迴收合)
  const getDescendants = useCallback(
    (rootId: string): Set<string> => {
      const desc = new Set<string>();
      const queue = [rootId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        const kids = childrenOf.get(curr) ?? [];
        for (const k of kids) {
          if (!desc.has(k)) {
            desc.add(k);
            queue.push(k);
          }
        }
      }
      return desc;
    },
    [childrenOf],
  );

  // 開啟視窗初始化（預設單一體系開展）
  useLayoutEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    setMatchIds(new Set());
    setSelectedNode(null);
    setHoverId(null);
    setExpandedIds(new Set(['root', 'factory']));
    applyVisual(null, 'hover', new Set());
    didInitialZoom.current = false;
  }, [isOpen, applyVisual]);

  // 開啟後自動對焦全景
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      if (!didInitialZoom.current) {
        didInitialZoom.current = true;
        graphRef.current?.zoomToFit(700, 75);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // 空間緩慢自轉控制 (requestAnimationFrame 驅動相機平滑環繞，冷卻/靜態模式下保證 100% 旋轉)
  useEffect(() => {
    if (!isOpen || !autoRotate || selectedNode) return;

    let animId: number;

    const rotateLoop = () => {
      const fg = graphRef.current;
      if (fg) {
        const camera = fg.camera?.() as THREE.PerspectiveCamera | undefined;
        if (camera) {
          const radius = Math.hypot(camera.position.x, camera.position.z);
          if (radius > 10) {
            const currentAngle = Math.atan2(camera.position.z, camera.position.x);
            const nextAngle = currentAngle + 0.0016; // 柔和緩慢自轉速度
            camera.position.x = radius * Math.cos(nextAngle);
            camera.position.z = radius * Math.sin(nextAngle);
            camera.lookAt(0, 0, 0);
          }
        }
        const ctrl = fg.controls?.() as { update?: () => void } | undefined;
        ctrl?.update?.();
      }
      animId = requestAnimationFrame(rotateLoop);
    };

    animId = requestAnimationFrame(rotateLoop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isOpen, autoRotate, selectedNode]);

  const clearFocus = useCallback(() => {
    setSelectedNode(null);
    setMatchIds(new Set());
    setSearchQuery('');
    applyVisual(null, 'hover', new Set());
  }, [applyVisual]);

  // 點擊節點：自由切換展開 / 收合（按需展開，避免眼花撩亂）+ 側邊欄呈現完整資訊與從屬關係
  const handleNodeClick = useCallback(
    (node: MM3DNode & { x?: number; y?: number; z?: number }) => {
      const id = node.id;
      const isAlreadyExpanded = expandedIds.has(id);
      const isAlreadySelected = selectedNode?.id === id;
      const hasChildren = (childrenOf.get(id)?.length ?? 0) > 0;

      setSelectedNode(node);

      if (hasChildren) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          if (isAlreadyExpanded && isAlreadySelected && id !== 'root') {
            // 已選中且已展開時再次點擊：遞迴收合子節點 (Cascading Collapse)
            next.delete(id);
            const desc = getDescendants(id);
            for (const d of desc) next.delete(d);
          } else {
            // 展開此節點並確保祖先鏈完整
            next.add(id);
            let curr: string | undefined = id;
            while (curr) {
              const pid = parentOf.get(curr);
              if (pid) next.add(pid);
              curr = pid;
            }
          }
          return next;
        });
      }

      applyVisual(id, 'selected', new Set());

      // 相機平滑移近對焦
      if (node.x !== undefined && node.y !== undefined && node.z !== undefined) {
        const dist = Math.sqrt(node.x * node.x + node.y * node.y + node.z * node.z);
        const k = dist < 20 ? 3.0 : 1.75;
        graphRef.current?.cameraPosition(
          { x: node.x * k + 25, y: node.y * k + 15, z: node.z * k + 35 },
          { x: node.x, y: node.y, z: node.z },
          650,
        );
      }
    },
    [applyVisual, childrenOf, expandedIds, getDescendants, parentOf, selectedNode],
  );

  const handleNodeHover = useCallback(
    (node: (MM3DNode & { id?: string | number }) | null) => {
      const id = node ? String(node.id) : null;
      setHoverId(id);
      if (selectedNode || matchIds.size > 0) return;
      for (const n of fullNodes) {
        const base = n._valBase ?? (n.r / NODE_REL_SIZE) ** 3;
        if (id && n.id === id) {
          n._val = base * 2.5;
          n._color = SELECTED_COLOR;
        } else {
          n._val = base;
          n._color = n.color;
        }
      }
      setVizTick((t) => t + 1);
    },
    [fullNodes, matchIds.size, selectedNode],
  );

  const handleBackgroundClick = useCallback(() => {
    clearFocus();
  }, [clearFocus]);

  // 搜尋過濾
  const handleSearchChange = useCallback(
    (v: string) => {
      setSearchQuery(v);
      const q = v.trim().toLowerCase();
      const m = new Set<string>();
      if (q) {
        for (const n of fullNodes) {
          const hay = [
            n.label,
            n.sublabel,
            n.part?.partNo,
            n.part?.name,
            n.part?.customer,
            ...(n.part?.alternates ?? []),
            ...(n.parts?.map((p) => `${p.partNo} ${p.name} ${p.customer || ''}`) ?? []),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (hay.includes(q)) m.add(n.id);
        }
      }
      setMatchIds(m);
      if (m.size > 0) {
        // 自動展開所有包含匹配節點與其祖先路徑
        setExpandedIds((prev) => {
          const next = new Set(prev);
          for (const matchId of m) {
            next.add(matchId);
            let curr: string | undefined = matchId;
            while (curr) {
              const pid: string | undefined = parentOf.get(curr);
              if (pid) next.add(pid);
              curr = pid;
            }
          }
          return next;
        });
        applyVisual(null, 'matched', m);
        graphRef.current?.zoomToFit(700, 100, (n) => m.has(String(n.id)));
      } else {
        applyVisual(null, 'hover', new Set());
      }
    },
    [applyVisual, fullNodes, parentOf],
  );

  // 一鍵展開所有分支
  const handleExpandAll = useCallback(() => {
    const all = new Set<string>();
    for (const n of fullNodes) all.add(n.id);
    setExpandedIds(all);
  }, [fullNodes]);

  // 一鍵收合至頂層
  const handleCollapseToTop = useCallback(() => {
    setExpandedIds(new Set(['root']));
    clearFocus();
    graphRef.current?.zoomToFit(650, 75);
  }, [clearFocus]);

  // 返回預設狀態（單一體系第 1 階開展）
  const handleResetDefault = useCallback(() => {
    setExpandedIds(new Set(['root', 'factory']));
    clearFocus();
    graphRef.current?.zoomToFit(650, 75);
  }, [clearFocus]);

  // 三大體系專屬切換（支援「開」與「收」自由控制與聚焦）
  const handleSystemToggle = useCallback(
    (systemId: string) => {
      const isExpanded = expandedIds.has(systemId);
      if (isExpanded) {
        // 收合體系：清除此體系與其所有子孫
        setExpandedIds((prev) => {
          const next = new Set(prev);
          next.delete(systemId);
          const desc = getDescendants(systemId);
          for (const d of desc) next.delete(d);
          return next;
        });
        if (selectedNode && (selectedNode.id === systemId || getDescendants(systemId).has(selectedNode.id))) {
          clearFocus();
        }
      } else {
        // 展開體系並相機聚焦
        setExpandedIds((prev) => {
          const next = new Set(prev);
          next.add('root');
          next.add(systemId);
          return next;
        });
        const node = byId.get(systemId);
        if (node) {
          setSelectedNode(node);
          applyVisual(systemId, 'selected', new Set());
          if (node.x !== undefined && node.y !== undefined && node.z !== undefined) {
            graphRef.current?.cameraPosition(
              { x: node.x * 1.8 + 25, y: node.y * 1.8 + 15, z: node.z * 1.8 + 35 },
              { x: node.x, y: node.y, z: node.z },
              650,
            );
          }
        }
      }
    },
    [applyVisual, byId, clearFocus, expandedIds, getDescendants, selectedNode],
  );

  // 點選祖先或子節點快速導航
  const navigateToNode = useCallback(
    (id: string) => {
      const node = byId.get(id);
      if (!node) return;
      // 確保其自身與祖先鏈皆已展開
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        let curr: string | undefined = id;
        while (curr) {
          const pid = parentOf.get(curr);
          if (pid) next.add(pid);
          curr = pid;
        }
        return next;
      });
      handleNodeClick(node);
    },
    [byId, handleNodeClick, parentOf],
  );

  // 縮圖與圖檔解析（支援語意推理父組件圖檔）
  const [thumb, setThumb] = useState<{
    url: string;
    name: string | null;
    via: 'file' | 'binding' | 'ocr' | 'inference' | null;
    inferenceSource?: string;
  } | null>(null);
  const [thumbError, setThumbError] = useState(false);

  useEffect(() => {
    if (selectedNode?.part) {
      const res = resolveImage(
        selectedNode.part.partNo,
        selectedNode.part.alternates,
        imageLib,
        bindings,
        ocrIndex,
        selectedNode.part.usedInAssemblies,
      );
      setThumb(res ? { url: res.url, name: res.name, via: res.via, inferenceSource: res.inferenceSource } : null);
      setThumbError(false);
    } else {
      setThumb(null);
    }
  }, [selectedNode, imageLib, bindings, ocrIndex]);

  if (!isOpen) return null;

  // 計算選中節點的祖先路徑 (從 Root 到當前)
  const ancestors: MM3DNode[] = [];
  if (selectedNode) {
    let currId: string | undefined = parentOf.get(selectedNode.id);
    while (currId) {
      const p = byId.get(currId);
      if (p) ancestors.unshift(p);
      currId = parentOf.get(currId);
    }
  }

  // 計算選中節點的直接子節點與所屬品號
  const directChildren: MM3DNode[] = selectedNode
    ? (childrenOf.get(selectedNode.id) ?? [])
        .map((cid) => byId.get(cid))
        .filter((n): n is MM3DNode => !!n)
    : [];

  const totalPartsInTree = fullNodes.filter((n) => n.kind === 'part').length;
  const visibleNodesCount = graphData.nodes.length;
  const viaBadge =
    thumb?.via === 'file'
      ? '檔名比對'
      : thumb?.via === 'binding'
      ? '手動綁定'
      : thumb?.via === 'ocr'
      ? 'OCR辨識'
      : thumb?.via === 'inference'
      ? `語意推導 (${thumb.inferenceSource})`
      : null;

  return (
    <div className="fixed inset-0 w-screen h-screen z-50 bg-slate-950 flex flex-col overflow-hidden text-slate-100 select-none">
      {/* ── 頂部導航與工具列 ── */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900 gap-3 shrink-0 shadow-lg z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[13px] font-bold transition-all cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            返回主系統
          </button>
          <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <FolderTree className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              產品識別教育訓練 — 3D 思維導圖
              <span className="px-2 py-0.5 rounded-full text-[13px] font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                {APP_VERSION}
              </span>
            </h2>
            <p className="text-[13px] text-slate-400">
              當前可見 <span className="text-sky-400 font-bold">{visibleNodesCount}</span> 個節點 · 共{' '}
              <span className="text-emerald-400 font-bold">{totalPartsInTree}</span> 件品號 · 空間利用極致展開
            </p>
          </div>
        </div>

        {/* 搜尋框 + 操作鈕 */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="搜尋品號 / 名稱 / 分類..."
              className="pl-8 pr-4 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-[13px] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 w-52 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 重置按鈕 */}
          <button
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-[13px] font-bold transition-all cursor-pointer active:scale-95"
            title="一鍵重置視角並返回預設收合狀態"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>返回預設狀態</span>
          </button>
        </div>
      </div>

      {/* ── 操作導引列 ── */}
      <div className="px-5 py-1.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-[13px] text-slate-400 shrink-0">
        <div className="flex items-center gap-4">
          <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>
            🖱️ 拖曳旋轉視角 · 滾輪縮放 · 點擊任一節點「自動在 3D 空間展開子節點」並於右側面板查看完整訊息與從屬關係 ·
            點擊空白處關閉
          </span>
          {matchIds.size > 0 && <span className="text-amber-400 font-semibold">找到 {matchIds.size} 個匹配節點</span>}
        </div>
        {!imageLib && (
          <div className="flex items-center gap-1.5 text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 text-[13px]">
            <Sparkles className="w-3 h-3 shrink-0" />
            <span>提示：請回主頁右上角「圖檔資料夾」載入本機圖片以顯示縮圖</span>
          </div>
        )}
      </div>

      {/* ── 3D 圖譜畫布 ── */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative bg-slate-950">
        <ForceGraph3D<MM3DNode, MM3DLink>
          ref={graphRef}
          graphData={graphData}
          controlType="orbit"
          backgroundColor="#0B1220"
          showNavInfo={false}
          nodeRelSize={NODE_REL_SIZE}
          nodeOpacity={1}
          nodeVal={(n) => n._val ?? 1}
          nodeColor={(n) => n._color ?? n.color}
          nodeThreeObject={labelsOn ? nodeExtendObject : undefined}
          nodeThreeObjectExtend={true}
          nodeLabel={(n) => {
            const lines = [n.label];
            if (n.sublabel) lines.push(n.sublabel);
            if (n.kind === 'part' && n.part?.customer) lines.push(`客戶：${n.part.customer}`);
            if (n.kind !== 'part') {
              const count = n.parts.length || (childrenOf.get(n.id)?.length ?? 0);
              lines.push(`包含項目：${count}`);
            }
            return lines.join('\n');
          }}
          linkColor={(l) => (l as MM3DLink)._color ?? LINK_COLOR}
          linkOpacity={0.4}
          linkWidth={(l) => ((l as MM3DLink)._color === LINK_ACTIVE_COLOR ? 1.3 : 0.45)}
          linkDirectionalParticles={(l) => ((l as MM3DLink)._color === LINK_ACTIVE_COLOR ? 3 : 0)}
          linkDirectionalParticleWidth={1.2}
          linkDirectionalParticleColor={() => SELECTED_COLOR}
          linkDirectionalParticleSpeed={0.007}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          onBackgroundClick={handleBackgroundClick}
          warmupTicks={30}
          cooldownTicks={0}
          enableNodeDrag={false}
          showPointerCursor={true}
        />
      </div>

      {/* ── 左側圖例與全局開關 ── */}
      <div className="absolute left-4 top-[118px] w-56 rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-md p-3.5 shadow-xl z-20">
        <div className="text-[13px] font-bold text-slate-200 mb-2 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          三大體系圖例
        </div>
        <div className="flex flex-col gap-2">
          {tree.children.map((b) => {
            const isExpanded = expandedIds.has(b.id);
            const partCount =
              b.parts.length || (childrenOf.get(b.id) ?? []).reduce((acc, cid) => acc + (byId.get(cid)?.parts.length ?? 0), 0);
            return (
              <button
                key={b.id}
                onClick={() => handleSystemToggle(b.id)}
                className={`flex items-center gap-2 text-[13px] p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  isExpanded
                    ? 'bg-slate-800 border-indigo-500/50 shadow-sm'
                    : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700/60 opacity-85 hover:opacity-100'
                }`}
                title={isExpanded ? `點擊收合【${b.label}】` : `點擊展開【${b.label}】並聚焦`}
              >
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: b.borderColor }} />
                <div className="flex-1 min-w-0">
                  <div className="text-slate-200 font-bold truncate">{b.label}</div>
                  <div className="text-[13px] text-slate-400 font-mono">
                    {partCount > 0 ? `${partCount} 件品號` : '分類體系'}
                  </div>
                </div>
                <span
                  className={`text-[13px] px-1.5 py-0.5 rounded font-mono font-bold transition-colors ${
                    isExpanded
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-slate-700/50 text-slate-400 border border-transparent'
                  }`}
                >
                  {isExpanded ? '開' : '收'}
                </span>
              </button>
            );
          })}
        </div>

        {/* 展開/收合控制按鈕 */}
        <div className="grid grid-cols-2 gap-1.5 mt-3 pt-3 border-t border-slate-800">
          <button
            onClick={handleExpandAll}
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[13px] font-semibold transition-all cursor-pointer"
            title="全部展開所有 3D 空間節點"
          >
            <ChevronsDown className="w-3.5 h-3.5 text-sky-400" />
            <span>全部展開</span>
          </button>
          <button
            onClick={handleCollapseToTop}
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[13px] font-semibold transition-all cursor-pointer"
            title="收合至最頂層"
          >
            <ChevronsUp className="w-3.5 h-3.5 text-amber-400" />
            <span>收合頂層</span>
          </button>
        </div>

        {/* 視覺開關 */}
        <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-slate-800">
          <button
            onClick={() => setLabelsOn((v) => !v)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[13px] font-bold transition-all cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              {labelsOn ? <Eye className="w-3.5 h-3.5 text-indigo-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
              <span>名稱標籤</span>
            </div>
            <span className="text-slate-400 text-[13px] font-mono">{labelsOn ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setAutoRotate((v) => !v)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[13px] font-bold transition-all cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              {autoRotate ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-slate-500" />}
              <span>空間緩慢自轉</span>
            </div>
            <span className="text-slate-400 text-[13px] font-mono">{autoRotate ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* ── 右側節點完整訊息與父子/從屬關係詳情面板 ── */}
      {selectedNode && (
        <div className="absolute right-4 top-[118px] bottom-4 w-96 rounded-2xl border border-slate-800 bg-slate-900/95 backdrop-blur-md shadow-2xl z-20 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
          {/* 面板 Header */}
          <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2 shrink-0">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: selectedNode.color }} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-slate-100 truncate">
                {selectedNode.kind === 'root'
                  ? '頂層根節點'
                  : selectedNode.kind === 'branch'
                  ? '主體系節點'
                  : selectedNode.kind === 'category'
                  ? '產品分類節點'
                  : selectedNode.kind === 'subcategory'
                  ? '子分類節點'
                  : '品號實體節點'}
              </div>
              <div className="text-[13px] font-mono text-sky-300 truncate">{selectedNode.label}</div>
            </div>
            <button
              onClick={() => clearFocus()}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer shrink-0"
              title="關閉詳情面板"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 面板內容捲軸區 */}
          <div className="flex-1 overflow-y-auto px-4 py-3.5 flex flex-col gap-4">
            {/* 1. 從屬階層路徑 (Ancestor Breadcrumbs) */}
            <div>
              <div className="text-[13px] font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                <FolderTree className="w-3.5 h-3.5 text-indigo-400" />
                <span>從屬階層路徑（可點選導航）</span>
              </div>
              <div className="flex flex-wrap items-center gap-1 bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                {ancestors.map((anc) => (
                  <React.Fragment key={anc.id}>
                    <button
                      onClick={() => navigateToNode(anc.id)}
                      className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[13px] font-medium transition-all cursor-pointer truncate max-w-[140px]"
                      title={`跳轉至父層：${anc.label}`}
                    >
                      {anc.label}
                    </button>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  </React.Fragment>
                ))}
                <span className="px-2 py-0.5 rounded-md bg-indigo-600/30 text-sky-200 border border-indigo-500/40 text-[13px] font-bold truncate max-w-[150px]">
                  {selectedNode.label}
                </span>
              </div>
            </div>

            {/* 2. 品號節點專屬資訊 */}
            {selectedNode.part && (
              <>
                {/* 縮圖展示 */}
                {thumb && !thumbError && (
                  <div className="w-full h-44 flex items-center justify-center bg-slate-950 rounded-xl border border-slate-800 relative overflow-hidden">
                    {thumb.name?.toLowerCase().endsWith('.pdf') ? (
                      <iframe
                        src={thumb.url + '#toolbar=0&navpanes=0&scrollbar=0&view=FitH'}
                        title={selectedNode.part.partNo}
                        className="w-full h-full border-0"
                        onError={() => setThumbError(true)}
                      />
                    ) : (
                      <img
                        src={thumb.url}
                        alt={selectedNode.part.partNo}
                        className="max-w-full max-h-full object-contain"
                        onError={() => setThumbError(true)}
                      />
                    )}
                    {viaBadge && (
                      <span className="absolute bottom-1.5 right-2 text-[13px] px-2 py-0.5 rounded bg-slate-900/90 text-emerald-300 border border-emerald-500/30 font-medium">
                        {viaBadge}
                      </span>
                    )}
                    {thumb.name && (
                      <span className="absolute bottom-1.5 left-2 text-[13px] font-mono text-slate-400 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-700 truncate max-w-[60%]">
                        {thumb.name}
                      </span>
                    )}
                  </div>
                )}
                {!thumb && (
                  <div className="w-full h-28 flex flex-col items-center justify-center gap-1.5 bg-slate-950 rounded-xl border border-slate-800 text-slate-500">
                    <Sparkles className="w-6 h-6 opacity-40" />
                    <span className="text-[13px]">尚無對應工程圖檔</span>
                  </div>
                )}

                {/* 品號規格標題與查 BOM 跳轉 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-slate-100">{selectedNode.part.name || '—'}</div>
                    {selectedNode.part.customer && (
                      <div className="text-[13px] text-slate-400 mt-0.5">
                        客戶：<span className="text-slate-200 font-semibold">{selectedNode.part.customer}</span>
                      </div>
                    )}
                  </div>
                  {onSelectPart && (
                    <button
                      onClick={() => {
                        onSelectPart(selectedNode.part!.partNo);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[13px] font-bold transition-all cursor-pointer active:scale-95 shrink-0"
                      title="跳轉至主頁查詢此品號之 BOM 階層"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>查 BOM</span>
                    </button>
                  )}
                </div>

                {/* 替代料號 */}
                {(selectedNode.part.alternates?.length ?? 0) > 0 && (
                  <div>
                    <div className="text-[13px] text-slate-400 mb-1.5 font-semibold">
                      替代/對應品號（{selectedNode.part.alternates!.length}）
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedNode.part.alternates!.map((alt) => (
                        <span
                          key={alt}
                          className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[13px] font-mono text-amber-300"
                        >
                          {alt}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* BOM 子零件組成 */}
                {(selectedNode.part.components?.length ?? 0) > 0 && (
                  <div>
                    <div className="text-[13px] text-slate-400 mb-1.5 font-semibold">
                      BOM 組成零件（{selectedNode.part.components!.length}）
                    </div>
                    <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                      {selectedNode.part.components!.map((c) => {
                        const childPartNode = fullNodes.find(
                          (n) => n.kind === 'part' && (n.label === c || n.part?.alternates?.includes(c)),
                        );
                        return (
                          <button
                            key={c}
                            onClick={() => childPartNode && navigateToNode(childPartNode.id)}
                            disabled={!childPartNode}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left text-[13px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-default"
                          >
                            <span className="font-mono text-sky-300 truncate">{c}</span>
                            {childPartNode && (
                              <span className="text-slate-400 truncate max-w-[50%]">{childPartNode.sublabel}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 上層組件 */}
                {(selectedNode.part.usedInAssemblies?.length ?? 0) > 0 && (
                  <div>
                    <div className="text-[13px] text-slate-400 mb-1.5 font-semibold">
                      用於上層組件（{selectedNode.part.usedInAssemblies!.length}）
                    </div>
                    <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                      {selectedNode.part.usedInAssemblies!.map((a) => {
                        const parentPartNode = fullNodes.find(
                          (n) => n.kind === 'part' && (n.label === a || n.part?.alternates?.includes(a)),
                        );
                        return (
                          <button
                            key={a}
                            onClick={() => parentPartNode && navigateToNode(parentPartNode.id)}
                            disabled={!parentPartNode}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left text-[13px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-default"
                          >
                            <span className="font-mono text-violet-300 truncate">{a}</span>
                            {parentPartNode && (
                              <span className="text-slate-400 truncate max-w-[50%]">{parentPartNode.sublabel}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 3. 分類/體系節點專屬資訊 */}
            {!selectedNode.part && (
              <>
                {selectedNode.sublabel && (
                  <div className="text-[13px] text-slate-300 leading-relaxed bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                    {selectedNode.sublabel}
                  </div>
                )}

                {/* 直接子節點列表 */}
                {directChildren.length > 0 && (
                  <div>
                    <div className="text-[13px] font-bold text-slate-400 mb-1.5">
                      直接子節點 / 子體系（{directChildren.length}）
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {directChildren.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => navigateToNode(c.id)}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left text-[13px] transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                            <span className="text-slate-200 font-bold truncate">{c.label}</span>
                          </div>
                          <span className="text-[13px] text-slate-400 font-mono shrink-0">
                            {c.parts.length > 0
                              ? `${c.parts.length} 件`
                              : c.childIds.length > 0
                              ? `${c.childIds.length} 個子類`
                              : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 包含的品號列表（若為末端分類） */}
                {selectedNode.parts.length > 0 && (
                  <div>
                    <div className="text-[13px] font-bold text-slate-400 mb-1.5 flex items-center justify-between">
                      <span>包含品號清單（{selectedNode.parts.length}）</span>
                    </div>
                    <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
                      {selectedNode.parts.map((p) => {
                        const partNodeId = `part:${p.partNo}`;
                        return (
                          <div
                            key={p.partNo}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-[13px] transition-all"
                          >
                            <button
                              onClick={() => navigateToNode(partNodeId)}
                              className="font-mono text-sky-300 font-bold hover:underline cursor-pointer truncate text-left"
                              title="在 3D 空間定位此品號"
                            >
                              {p.partNo}
                            </button>
                            <span className="text-slate-400 truncate flex-1 text-right">{p.name}</span>
                            {onSelectPart && (
                              <button
                                onClick={() => {
                                  onSelectPart(p.partNo);
                                  onClose();
                                }}
                                className="p-1 rounded text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer shrink-0"
                                title="跳轉至主頁查 BOM"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 左下空間資訊浮標 ── */}
      <div className="absolute left-4 bottom-4 rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 text-[13px] text-slate-400 shadow-xl z-20 flex items-center gap-3">
        <span>
          可見節點 <span className="font-mono text-slate-200 font-bold">{visibleNodesCount}</span> / {fullNodes.length}
        </span>
        <span className="text-slate-700">|</span>
        <span>
          空間連線 <span className="font-mono text-slate-200 font-bold">{graphData.links.length}</span>
        </span>
        <span className="text-slate-700">|</span>
        <span>
          懸停：
          {hoverId ? (
            <span className="font-mono text-sky-300 font-bold">{hoverId.replace(/^part:/, '')}</span>
          ) : (
            <span className="text-slate-500">—</span>
          )}
        </span>
      </div>
    </div>
  );
};
