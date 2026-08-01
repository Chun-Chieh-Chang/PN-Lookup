import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Search, RotateCcw, Box, Compass, Sparkles, Layers, Info, Check, Eye } from 'lucide-react';
import { PartItem } from '../types';
import {
  buildProductKnowledgeGraph,
  GraphNode,
  GraphLink,
  GROUP_COLORS,
} from '../utils/productKnowledgeGraph';

interface ProductGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  parts: PartItem[];
  onSelectPart?: (partNo: string) => void;
}

type ViewMode = '2D' | '3D';

export const ProductGraphModal: React.FC<ProductGraphModalProps> = ({
  isOpen,
  onClose,
  parts,
  onSelectPart,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('2D');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 建構圖譜數據
  const graphData = useMemo(() => {
    return buildProductKnowledgeGraph(parts);
  }, [parts]);

  // 初始化節點座標與 3D 空間佈局
  const nodesWithPos = useMemo(() => {
    const total = graphData.nodes.length;
    return graphData.nodes.map((node, idx) => {
      const phi = Math.acos(-1 + (2 * idx) / total);
      const theta = Math.sqrt(total * Math.PI) * phi;
      const radius = 220 + (node.val * 4);

      return {
        ...node,
        x: (Math.random() - 0.5) * 400,
        y: (Math.random() - 0.5) * 400,
        z: (Math.random() - 0.5) * 400,
        x3d: radius * Math.cos(theta) * Math.sin(phi),
        y3d: radius * Math.sin(theta) * Math.sin(phi),
        z3d: radius * Math.cos(phi),
        vx: 0,
        vy: 0,
        vz: 0,
      };
    });
  }, [graphData]);

  // 搜尋過濾高亮節點
  const matchedNodeIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return new Set<string>();
    const hits = new Set<string>();
    for (const node of nodesWithPos) {
      if (
        node.id.toLowerCase().includes(q) ||
        node.name.toLowerCase().includes(q) ||
        (node.description && node.description.toLowerCase().includes(q))
      ) {
        hits.add(node.id);
      }
    }
    return hits;
  }, [nodesWithPos, searchQuery]);

  // Canvas 2D / 3D 動畫繪製引擎
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let angleX = 0;
    let angleY = 0;

    interface NodeWith3D extends GraphNode {
      x: number;
      y: number;
      z: number;
      x3d: number;
      y3d: number;
      z3d: number;
    }

    // 簡單力導向迭代
    const simNodes: NodeWith3D[] = nodesWithPos.map((n) => ({ ...n }));
    const nodeMap = new Map<string, NodeWith3D>(simNodes.map((n) => [n.id, n]));

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;

      ctx.clearRect(0, 0, width, height);

      // 自動背景微漩渦星空背景
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, width, height);

      if (autoRotate && viewMode === '3D') {
        angleY += 0.005;
        angleX += 0.002;
      }

      // 繪製連線 Links
      ctx.lineWidth = 0.8;
      for (const link of graphData.links) {
        const sourceNode = nodeMap.get(link.source);
        const targetNode = nodeMap.get(link.target);
        if (!sourceNode || !targetNode) continue;

        let sx = sourceNode.x;
        let sy = sourceNode.y;
        let tx = targetNode.x;
        let ty = targetNode.y;

        if (viewMode === '3D') {
          // 3D 矩陣投影
          const cosY = Math.cos(angleY);
          const sinY = Math.sin(angleY);
          const cosX = Math.cos(angleX);
          const sinX = Math.sin(angleX);

          // Source 3D -> 2D
          const x1 = sourceNode.x3d * cosY - sourceNode.z3d * sinY;
          const z1 = sourceNode.x3d * sinY + sourceNode.z3d * cosY;
          const y1 = sourceNode.y3d * cosX - z1 * sinX;
          const scale1 = 400 / (400 + z1 + 250);
          sx = x1 * scale1;
          sy = y1 * scale1;

          // Target 3D -> 2D
          const x2 = targetNode.x3d * cosY - targetNode.z3d * sinY;
          const z2 = targetNode.x3d * sinY + targetNode.z3d * cosY;
          const y2 = targetNode.y3d * cosX - z2 * sinX;
          const scale2 = 400 / (400 + z2 + 250);
          tx = x2 * scale2;
          ty = y2 * scale2;
        }

        const isHighlight =
          (selectedNode && (selectedNode.id === link.source || selectedNode.id === link.target)) ||
          matchedNodeIds.has(link.source) ||
          matchedNodeIds.has(link.target);

        ctx.strokeStyle = isHighlight ? 'rgba(99, 102, 241, 0.6)' : 'rgba(148, 163, 184, 0.15)';
        ctx.lineWidth = isHighlight ? 1.5 : 0.8;
        ctx.beginPath();
        ctx.moveTo(cx + sx, cy + sy);
        ctx.lineTo(cx + tx, cy + ty);
        ctx.stroke();
      }

      // 繪製節點 Nodes
      for (const node of simNodes) {
        let drawX = node.x;
        let drawY = node.y;
        let drawScale = 1;

        if (viewMode === '3D') {
          const cosY = Math.cos(angleY);
          const sinY = Math.sin(angleY);
          const cosX = Math.cos(angleX);
          const sinX = Math.sin(angleX);

          const x1 = node.x3d * cosY - node.z3d * sinY;
          const z1 = node.x3d * sinY + node.z3d * cosY;
          const y1 = node.y3d * cosX - z1 * sinX;
          drawScale = 400 / (400 + z1 + 250);
          drawX = x1 * drawScale;
          drawY = y1 * drawScale;
        }

        const r = Math.max(4, node.val * 0.45 * (viewMode === '3D' ? drawScale : 1));
        const screenX = cx + drawX;
        const screenY = cy + drawY;

        const isSelected = selectedNode?.id === node.id;
        const isMatched = matchedNodeIds.has(node.id);

        // 外發光圓環
        if (isSelected || isMatched) {
          ctx.beginPath();
          ctx.arc(screenX, screenY, r + 6, 0, 2 * Math.PI);
          ctx.fillStyle = isSelected ? 'rgba(99, 102, 241, 0.4)' : 'rgba(245, 158, 11, 0.4)';
          ctx.fill();
        }

        // 節點實體
        ctx.beginPath();
        ctx.arc(screenX, screenY, r, 0, 2 * Math.PI);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        // 標籤文字 (重點節點或選取節點顯示)
        if (node.val >= 12 || isSelected || isMatched) {
          ctx.fillStyle = isSelected ? '#FFFFFF' : '#E2E8F0';
          ctx.font = isSelected ? 'bold 12px monospace' : '11px sans-serif';
          ctx.fillText(node.name, screenX + r + 4, screenY + 4);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen, viewMode, nodesWithPos, graphData, selectedNode, matchedNodeIds, autoRotate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span>凱益醫療產品知識與 BOM 網絡圖譜</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {graphData.nodes.length} 節點 · {graphData.links.length} 關聯
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                整合《產品識別教育訓練》與《編碼記憶》規則，雙向展算 SA/SB/SC/SD 組立與實體零件結構
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* 2D / 3D Mode Switcher */}
            <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
              <button
                onClick={() => setViewMode('2D')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === '2D'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                2D 繪圖視圖
              </button>
              <button
                onClick={() => setViewMode('3D')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === '3D'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                3D 立體視圖
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋品號、SA/SB/SC/SD 前綴或編碼名稱..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-4">
            {/* Color Legend */}
            <div className="flex items-center space-x-3 text-slate-300">
              <div className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]"></span>
                <span>編碼規則</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0EA5E9]"></span>
                <span>SA/SB/SC/SD 組立</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
                <span>單品零件</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]"></span>
                <span>客戶別名</span>
              </div>
            </div>

            {viewMode === '3D' && (
              <button
                onClick={() => setAutoRotate(!autoRotate)}
                className={`px-2.5 py-1 rounded-lg border font-semibold transition-colors cursor-pointer ${
                  autoRotate
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {autoRotate ? '旋轉中 旋' : '定格視角'}
              </button>
            )}
          </div>
        </div>

        {/* Main Canvas Viewport */}
        <div className="flex-1 relative overflow-hidden bg-slate-950 flex">
          <canvas
            ref={canvasRef}
            width={1200}
            height={700}
            onClick={(e) => {
              const rect = canvasRef.current?.getBoundingClientRect();
              if (!rect || !canvasRef.current) return;
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              const cx = canvasRef.current.width / 2;
              const cy = canvasRef.current.height / 2;

              // 簡單距離點擊判斷
              const hit = nodesWithPos.find((n) => {
                const dist = Math.hypot(cx + (n.x ?? 0) - x, cy + (n.y ?? 0) - y);
                return dist <= (n.val * 0.8 + 6);
              });
              setSelectedNode(hit || null);
            }}
            className="w-full h-full cursor-crosshair"
          />

          {/* Node Details Floating Card Panel */}
          {selectedNode && (
            <div className="absolute right-6 top-6 w-80 bg-slate-900/90 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl p-5 space-y-4 text-slate-100 z-10 animate-in fade-in slide-in-from-right-4">
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
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-300 space-y-2 border-t border-slate-800 pt-3">
                <p className="leading-relaxed">{selectedNode.description || '暫無詳細說明'}</p>

                {selectedNode.details && (
                  <div className="bg-slate-950/60 rounded-xl p-3 space-y-1.5 font-mono border border-slate-800/80">
                    {selectedNode.details.customer && (
                      <p><span className="text-slate-400">客戶:</span> {selectedNode.details.customer}</p>
                    )}
                    {selectedNode.details.category && (
                      <p><span className="text-slate-400">類別:</span> {selectedNode.details.category}</p>
                    )}
                    {selectedNode.details.material && (
                      <p><span className="text-slate-400">原料:</span> {selectedNode.details.material}</p>
                    )}
                    {selectedNode.details.componentsCount !== undefined && (
                      <p><span className="text-slate-400">BOM零件數:</span> {selectedNode.details.componentsCount} 件</p>
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
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-lg"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>跳轉查看料號詳情與 BOM ➔</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400">
          <span>提示：支援滾輪放縮、拖拽節點或點擊節點查看編碼邏輯與 BOM 關係</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium transition-colors cursor-pointer"
          >
            關閉圖譜
          </button>
        </div>

      </div>
    </div>
  );
};
