import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Search,
  RotateCcw,
  Compass,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Eye,
  Layers,
  Play,
  Pause,
  ArrowLeft,
  Building2,
  Factory,
  Globe,
} from 'lucide-react';
import { PartItem } from '../types';
import {
  buildProductKnowledgeGraph,
  GraphNode,
  GraphLink,
  GROUP_COLORS,
  NodeGroup,
} from '../utils/productKnowledgeGraph';

interface ProductGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  parts: PartItem[];
  onSelectPart?: (partNo: string) => void;
}

type ViewMode = '2D' | '3D';
type AxisFilterMode = 'all' | 'factory' | 'customer';

export const ProductGraphModal: React.FC<ProductGraphModalProps> = ({
  isOpen,
  onClose,
  parts,
  onSelectPart,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('3D');
  const [axisFilter, setAxisFilter] = useState<AxisFilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  // 視角與軌道球 (Orbit & Pan & Zoom) 控制狀態
  const [rotX, setRotX] = useState(0.3);
  const [rotY, setRotY] = useState(0.5);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'rotate' | 'pan'>('rotate');
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 建構雙軸心圖譜數據
  const graphData = useMemo(() => {
    return buildProductKnowledgeGraph(parts, axisFilter);
  }, [parts, axisFilter]);

  // 重置視角與軌道歸位
  const handleResetView = useCallback(() => {
    setRotX(0.3);
    setRotY(0.5);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    setSelectedNode(null);
    setSearchQuery('');
  }, []);

  // 鄰近對應節點 Map（用於 Tool-Calling 鄰近高亮）
  const neighborNodeIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const set = new Set<string>([selectedNode.id]);
    for (const link of graphData.links) {
      if (link.source === selectedNode.id) set.add(link.target);
      if (link.target === selectedNode.id) set.add(link.source);
    }
    return set;
  }, [selectedNode, graphData.links]);

  // 搜尋過濾高亮節點
  const matchedNodeIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return new Set<string>();
    const hits = new Set<string>();
    for (const node of graphData.nodes) {
      if (
        node.id.toLowerCase().includes(q) ||
        node.name.toLowerCase().includes(q) ||
        (node.description && node.description.toLowerCase().includes(q))
      ) {
        hits.add(node.id);
      }
    }
    return hits;
  }, [graphData.nodes, searchQuery]);

  // 初始化 3D 空間幾何佈局
  const nodesWithPos = useMemo(() => {
    const total = graphData.nodes.length;
    return graphData.nodes.map((node, idx) => {
      const phi = Math.acos(-1 + (2 * idx) / total);
      const theta = Math.sqrt(total * Math.PI) * phi;
      const radius = 260 + node.val * 3.5;

      return {
        ...node,
        x: (Math.random() - 0.5) * 500,
        y: (Math.random() - 0.5) * 500,
        z: (Math.random() - 0.5) * 500,
        x3d: radius * Math.cos(theta) * Math.sin(phi),
        y3d: radius * Math.sin(theta) * Math.sin(phi),
        z3d: radius * Math.cos(phi),
      };
    });
  }, [graphData]);

  // 滑鼠軌道球與視角事件綁定
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (e.button === 2 || e.shiftKey) {
      setDragMode('pan');
    } else {
      setDragMode('rotate');
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !lastMousePos.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (dragMode === 'rotate') {
      setRotY((prev) => prev + dx * 0.008);
      setRotX((prev) => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, prev + dy * 0.008)));
    } else {
      setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    lastMousePos.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    setZoom((prev) => Math.max(0.3, Math.min(4.5, prev * zoomFactor)));
  };

  // Canvas 2D / 3D 動畫與脈衝光流繪製引擎
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let pulseOffset = 0;

    interface NodeWith3D extends GraphNode {
      x: number;
      y: number;
      z: number;
      x3d: number;
      y3d: number;
      z3d: number;
    }

    const simNodes: NodeWith3D[] = nodesWithPos.map((n) => ({ ...n }));
    const nodeMap = new Map<string, NodeWith3D>(simNodes.map((n) => [n.id, n]));

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2 + panOffset.x;
      const cy = height / 2 + panOffset.y;

      pulseOffset = (pulseOffset + 0.03) % 1;

      ctx.clearRect(0, 0, width, height);

      // 深邃星空背景
      ctx.fillStyle = '#080C14';
      ctx.fillRect(0, 0, width, height);

      const currentRotY = autoRotate && !isDragging && viewMode === '3D' ? rotY + 0.0025 : rotY;
      if (autoRotate && !isDragging && viewMode === '3D') {
        setRotY(currentRotY);
      }

      const cosY = Math.cos(currentRotY);
      const sinY = Math.sin(currentRotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // 1. 繪製連線 Links
      for (const link of graphData.links) {
        const sourceNode = nodeMap.get(link.source);
        const targetNode = nodeMap.get(link.target);
        if (!sourceNode || !targetNode) continue;

        let sx = sourceNode.x * zoom;
        let sy = sourceNode.y * zoom;
        let tx = targetNode.x * zoom;
        let ty = targetNode.y * zoom;

        if (viewMode === '3D') {
          // 3D 矩陣投影
          const x1 = sourceNode.x3d * cosY - sourceNode.z3d * sinY;
          const z1 = sourceNode.x3d * sinY + sourceNode.z3d * cosY;
          const y1 = sourceNode.y3d * cosX - z1 * sinX;
          const scale1 = (400 / (400 + z1 + 220)) * zoom;
          sx = x1 * scale1;
          sy = y1 * scale1;

          const x2 = targetNode.x3d * cosY - targetNode.z3d * sinY;
          const z2 = targetNode.x3d * sinY + targetNode.z3d * cosY;
          const y2 = targetNode.y3d * cosX - z2 * sinX;
          const scale2 = (400 / (400 + z2 + 220)) * zoom;
          tx = x2 * scale2;
          ty = y2 * scale2;
        }

        const isLinkSelected =
          selectedNode && (selectedNode.id === link.source || selectedNode.id === link.target);
        const isMatched = matchedNodeIds.has(link.source) || matchedNodeIds.has(link.target);

        // 鄰近高亮判定
        const isDimmed =
          selectedNode && !neighborNodeIds.has(link.source) && !neighborNodeIds.has(link.target);

        ctx.lineWidth = isLinkSelected ? 2.5 : isMatched ? 1.8 : 0.8;
        ctx.strokeStyle = isLinkSelected
          ? '#6366F1'
          : isMatched
          ? '#F59E0B'
          : isDimmed
          ? 'rgba(148, 163, 184, 0.04)'
          : 'rgba(148, 163, 184, 0.16)';

        ctx.beginPath();
        ctx.moveTo(cx + sx, cy + sy);
        ctx.lineTo(cx + tx, cy + ty);
        ctx.stroke();

        // 脈衝微光 (Pulse Laser Effect)
        if (isLinkSelected || (selectedNode && !isDimmed)) {
          const px = cx + sx + (tx - sx) * pulseOffset;
          const py = cy + sy + (ty - sy) * pulseOffset;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, 2 * Math.PI);
          ctx.fillStyle = '#818CF8';
          ctx.fill();
        }
      }

      // 2. 繪製節點 Nodes
      for (const node of simNodes) {
        let drawX = node.x * zoom;
        let drawY = node.y * zoom;
        let drawScale = zoom;

        if (viewMode === '3D') {
          const x1 = node.x3d * cosY - node.z3d * sinY;
          const z1 = node.x3d * sinY + node.z3d * cosY;
          const y1 = node.y3d * cosX - z1 * sinX;
          drawScale = (400 / (400 + z1 + 220)) * zoom;
          drawX = x1 * drawScale;
          drawY = y1 * drawScale;
        }

        const r = Math.max(3.5, node.val * 0.45 * (viewMode === '3D' ? drawScale : zoom));
        const screenX = cx + drawX;
        const screenY = cy + drawY;

        const isSelected = selectedNode?.id === node.id;
        const isMatched = matchedNodeIds.has(node.id);
        const isNeighbor = neighborNodeIds.has(node.id);
        const isDimmed = selectedNode && !isNeighbor;

        ctx.globalAlpha = isDimmed ? 0.2 : 1.0;

        // 外發光 Aura
        if (isSelected || isMatched) {
          ctx.beginPath();
          ctx.arc(screenX, screenY, r + 7, 0, 2 * Math.PI);
          ctx.fillStyle = isSelected ? 'rgba(99, 102, 241, 0.45)' : 'rgba(245, 158, 11, 0.45)';
          ctx.fill();
        }

        // 節點本體
        ctx.beginPath();
        ctx.arc(screenX, screenY, r, 0, 2 * Math.PI);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.7)';
        ctx.lineWidth = isSelected ? 2.5 : 1;
        ctx.stroke();

        // 標籤文字 (重點節點/被選取/高亮節點)
        if (node.val >= 12 || isSelected || isMatched || isNeighbor) {
          ctx.fillStyle = isSelected ? '#FFFFFF' : isMatched ? '#FCD34D' : '#E2E8F0';
          ctx.font = isSelected ? 'bold 12px monospace' : '11px sans-serif';
          ctx.fillText(node.name, screenX + r + 5, screenY + 4);
        }

        ctx.globalAlpha = 1.0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    isOpen,
    viewMode,
    nodesWithPos,
    graphData,
    selectedNode,
    matchedNodeIds,
    neighborNodeIds,
    autoRotate,
    rotX,
    rotY,
    zoom,
    panOffset,
    isDragging,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 w-screen h-screen z-50 bg-slate-950 flex flex-col overflow-hidden text-slate-100 select-none">
      
      {/* Header Bar (Full Viewport) */}
      <div className="flex flex-wrap items-center justify-between px-6 py-3.5 border-b border-slate-800/80 bg-slate-900/90 gap-4 shrink-0 shadow-lg z-20">
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer mr-2 shadow-xs active:scale-95"
            title="離開圖譜並返回品號檢索主畫面"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回主檢視系統</span>
          </button>

          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Compass className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 font-sans">
              <span>雙軸心醫療產品知識與 BOM 網絡圖譜 (v5.0.0)</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {graphData.nodes.length} 節點 · {graphData.links.length} 關聯
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              融合【廠內 MindMap 6 大分類】與【《編碼記憶》K/Q/SA/SB/SC/SD 代碼】與【客戶採購體系】雙軸心
            </p>
          </div>
        </div>

        {/* 視角軸心與 2D/3D 切換器 */}
        <div className="flex flex-wrap items-center space-x-3 gap-y-2">
          {/* 軸心篩選 Mode */}
          <div className="flex items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700/80">
            <button
              onClick={() => setAxisFilter('all')}
              className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                axisFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>全景總圖譜</span>
            </button>
            <button
              onClick={() => setAxisFilter('factory')}
              className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                axisFilter === 'factory'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Factory className="w-3.5 h-3.5" />
              <span>廠內 MindMap 視角</span>
            </button>
            <button
              onClick={() => setAxisFilter('customer')}
              className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                axisFilter === 'customer'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>客戶採購視角</span>
            </button>
          </div>

          {/* 2D / 3D Mode */}
          <div className="flex items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700/80">
            <button
              onClick={() => setViewMode('2D')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === '2D'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2D 繪圖
            </button>
            <button
              onClick={() => setViewMode('3D')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === '3D'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              3D 軌道
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar & Filter */}
      <div className="px-6 py-2 border-b border-slate-800/80 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 z-20">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋品號、SA/SB/SC/SD 前綴、廠內分類或客戶名稱..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Color Legend */}
        <div className="hidden lg:flex items-center space-x-3 text-slate-300 text-[11px]">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]"></span>
            <span>Set 組合</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0EA5E9]"></span>
            <span>組件 (SA/SB/SC/SD)</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
            <span>單品零件</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EC4899]"></span>
            <span>原料屬性</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]"></span>
            <span>ICU 重症客戶</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EAB308]"></span>
            <span>OEM/ODM 客戶</span>
          </div>
        </div>
      </div>

      {/* Main Full Viewport Canvas */}
      <div className="flex-1 relative overflow-hidden bg-slate-950 flex">
        <canvas
          ref={canvasRef}
          width={window.innerWidth}
          height={window.innerHeight - 110}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => {
            if (isDragging) return;
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect || !canvasRef.current) return;
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const cx = canvasRef.current.width / 2 + panOffset.x;
            const cy = canvasRef.current.height / 2 + panOffset.y;

            const hit = nodesWithPos.find((n) => {
              const drawScale = viewMode === '3D' ? (400 / (400 + (n.z3d ?? 0) + 220)) * zoom : zoom;
              const r = Math.max(3.5, n.val * 0.45 * drawScale);
              const screenX = cx + (viewMode === '3D' ? (n.x3d ?? 0) * drawScale : (n.x ?? 0) * zoom);
              const screenY = cy + (viewMode === '3D' ? (n.y3d ?? 0) * drawScale : (n.y ?? 0) * zoom);
              return Math.hypot(screenX - x, screenY - y) <= (r + 8);
            });
            setSelectedNode(hit || null);
          }}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />

        {/* Floating Tool-Calling Control Dock */}
        <div className="absolute left-6 bottom-6 flex items-center bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-1.5 space-x-1 shadow-2xl z-20">
          <button
            onClick={() => setZoom((prev) => Math.min(4.5, prev * 1.25))}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="放大視角 (Zoom In)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((prev) => Math.max(0.3, prev * 0.8))}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="縮小視角 (Zoom Out)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-slate-700 mx-1" />
          <button
            onClick={handleResetView}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="重置視角與軌道 (Reset Camera Orbit)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {viewMode === '3D' && (
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                autoRotate
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={autoRotate ? '定格目前視角' : '開啟 3D 自動微軌道旋轉'}
            >
              {autoRotate ? <Pause className="w-4 h-4 text-indigo-400" /> : <Play className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Node Details Floating Panel */}
        {selectedNode && (
          <div className="absolute right-6 top-6 w-88 bg-slate-900/95 backdrop-blur-2xl border border-slate-700/90 rounded-2xl shadow-2xl p-5 space-y-4 text-slate-100 z-30 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-start justify-between">
              <div>
                <span
                  className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold uppercase"
                  style={{ backgroundColor: `${selectedNode.color}25`, color: selectedNode.color, borderColor: `${selectedNode.color}50` }}
                >
                  {selectedNode.group}
                </span>
                <h3 className="text-base font-bold text-white mt-1.5 font-mono">{selectedNode.name}</h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2.5 border-t border-slate-800 pt-3">
              <p className="leading-relaxed text-slate-300">{selectedNode.description || '暫無詳細說明'}</p>

              {selectedNode.details && (
                <div className="bg-slate-950/80 rounded-xl p-3 space-y-1.5 font-mono border border-slate-800/90 text-[11px]">
                  {selectedNode.details.customer && (
                    <p><span className="text-slate-400">客戶體系:</span> {selectedNode.details.customer}</p>
                  )}
                  {selectedNode.details.category && (
                    <p><span className="text-slate-400">物料類別:</span> {selectedNode.details.category}</p>
                  )}
                  {selectedNode.details.material && (
                    <p><span className="text-slate-400">原料成分:</span> {selectedNode.details.material}</p>
                  )}
                  {selectedNode.details.componentsCount !== undefined && (
                    <p><span className="text-slate-400">BOM 零件個數:</span> <strong className="text-indigo-400">{selectedNode.details.componentsCount} 件</strong></p>
                  )}
                </div>
              )}
            </div>

            {selectedNode.details?.partNo && onSelectPart && (
              <button
                onClick={() => {
                  if (selectedNode.details?.partNo) {
                    onSelectPart(selectedNode.details.partNo);
                    onClose();
                  }
                }}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-lg cursor-pointer active:scale-95"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>跳轉查看此料號與 BOM ➔</span>
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
