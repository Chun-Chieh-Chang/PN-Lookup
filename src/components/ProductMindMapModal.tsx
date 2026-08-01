import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  X,
  Search,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Package,
  Users,
  Cpu,
  Layers,
  Boxes,
  Syringe,
  FlaskConical,
  TriangleAlert,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info,
} from 'lucide-react';
import { PartItem } from '../types';
import { classifyPart, MindMapCategory } from '../utils/mindmapClassifier';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface MindMapNode {
  id: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  color: string;         // Tailwind bg color class
  textColor: string;     // Tailwind text color class
  borderColor: string;   // Tailwind border color class
  children: MindMapNode[];
  parts: PartItem[];     // 掛載的品號
  category?: MindMapCategory;
  depth: number;
}

interface ProductMindMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  parts: PartItem[];
  onSelectPart?: (partNo: string) => void;
}

// ────────────────────────────────────────────────────────────────────────────
// 顏色系統 (Morandi Palette)
// ────────────────────────────────────────────────────────────────────────────

const PALETTE = {
  root:       { bg: '#3B4A6B', border: '#6B7A9E', text: '#F0F4FF' },
  level1:     { bg: '#1E3A5F', border: '#3B82F6', text: '#93C5FD' },
  factoryPart:{ bg: '#134E4A', border: '#14B8A6', text: '#5EEAD4' },
  factoryAsm: { bg: '#1E3A5F', border: '#60A5FA', text: '#BFDBFE' },
  factorySet: { bg: '#3B0764', border: '#8B5CF6', text: '#C4B5FD' },
  icuBag:     { bg: '#7C2D12', border: '#F97316', text: '#FED7AA' },
  icuVial:    { bg: '#701A75', border: '#E879F9', text: '#F5D0FE' },
  customerBD: { bg: '#1C3144', border: '#38BDF8', text: '#BAE6FD' },
  customerOther: { bg: '#1F2937', border: '#6B7280', text: '#D1D5DB' },
  unclassified:  { bg: '#2D2D2D', border: '#6B7280', text: '#9CA3AF' },
  partNode:   { bg: '#0F172A', border: '#334155', text: '#94A3B8' },
};

// ────────────────────────────────────────────────────────────────────────────
// 建構 MindMap 樹狀結構
// ────────────────────────────────────────────────────────────────────────────

function buildMindMapTree(parts: PartItem[]): MindMapNode {
  // 依分類收集品號
  const buckets = new Map<MindMapCategory, PartItem[]>();
  const catList: MindMapCategory[] = [
    'factory_part_t_connector', 'factory_part_y_connector', 'factory_part_mll',
    'factory_part_fll', 'factory_part_cap', 'factory_part_clamp', 'factory_part_other',
    'factory_part_k_connector', 'factory_part_q_barbed',
    'factory_asm_sa', 'factory_asm_sb', 'factory_asm_sc', 'factory_asm_sd', 'factory_asm_special',
    'factory_set_mdxe', 'factory_set_mdxi',
    'customer_icu_bag_vented_port', 'customer_icu_bag_vented_clave',
    'customer_icu_bag_nonvented', 'customer_icu_bag_cap',
    'customer_icu_vial_nipple', 'customer_icu_vial_9035',
    'customer_icu_vial_flower', 'customer_icu_vial_cap',
    'customer_bd', 'customer_mps', 'customer_biometrix', 'customer_vivus',
    'unclassified',
  ];
  for (const cat of catList) buckets.set(cat, []);
  for (const part of parts) {
    const result = classifyPart(part);
    buckets.get(result.category)!.push(part);
  }

  const makeNode = (
    id: string, label: string, sublabel: string | undefined,
    palette: typeof PALETTE.root, depth: number,
    children: MindMapNode[], parts: PartItem[],
    cat?: MindMapCategory, icon?: React.ReactNode,
  ): MindMapNode => ({
    id, label, sublabel, icon,
    color: palette.bg, textColor: palette.text, borderColor: palette.border,
    children, parts, category: cat, depth,
  });

  // 零件子節點
  const partLeaf = (id: string, label: string, sublabel: string, cat: MindMapCategory): MindMapNode =>
    makeNode(id, label, sublabel, PALETTE.factoryPart, 3, [], buckets.get(cat)!, cat);

  // 廠內零件群
  const factoryPartNodes: MindMapNode[] = [
    partLeaf('ft-t', 'T接頭', 'A01 / A02 / A03', 'factory_part_t_connector'),
    partLeaf('ft-y', 'Y管', 'B05 / B06', 'factory_part_y_connector'),
    partLeaf('ft-mll', '針基/轉式 (MLL)', 'C09 / C11', 'factory_part_mll'),
    partLeaf('ft-fll', '針基/滑式 (FLL)', 'D09 / D10', 'factory_part_fll'),
    partLeaf('ft-cap', '針基蓋', 'E09 / E10 / E11', 'factory_part_cap'),
    partLeaf('ft-clamp', '夾具', 'F17 切斷器 / F18 夾緊器', 'factory_part_clamp'),
    partLeaf('ft-k', '連接管 K系列', 'K07 U型 / K08 三通 / K27 四通', 'factory_part_k_connector'),
    partLeaf('ft-q', '倒鉤式連接器 Q系列', 'Q09 MLL / Q10 FLL', 'factory_part_q_barbed'),
    partLeaf('ft-other', '其他', 'G05 針筒蓋 / G13 插入針 / H00 螺帽', 'factory_part_other'),
  ];

  const factoryAsmNodes: MindMapNode[] = [
    makeNode('fa-sa', 'SA 系列', '2 pcs 組合', PALETTE.factoryAsm, 3, [], buckets.get('factory_asm_sa')!, 'factory_asm_sa'),
    makeNode('fa-sb', 'SB 系列', '3 pcs 組合', PALETTE.factoryAsm, 3, [], buckets.get('factory_asm_sb')!, 'factory_asm_sb'),
    makeNode('fa-sc', 'SC 系列', '4 pcs 組合', PALETTE.factoryAsm, 3, [], buckets.get('factory_asm_sc')!, 'factory_asm_sc'),
    makeNode('fa-sd', 'SD 系列', '5 pcs 組合', PALETTE.factoryAsm, 3, [], buckets.get('factory_asm_sd')!, 'factory_asm_sd'),
    makeNode('fa-sp', '特殊品號', '如 3M41459', PALETTE.factoryAsm, 3, [], buckets.get('factory_asm_special')!, 'factory_asm_special'),
  ];

  const factorySetNodes: MindMapNode[] = [
    makeNode('fs-mdxe', 'MDXE', 'Extension set（不含插入針）', PALETTE.factorySet, 3, [], buckets.get('factory_set_mdxe')!, 'factory_set_mdxe'),
    makeNode('fs-mdxi', 'MDXI', 'I.V. set（含插入針）', PALETTE.factorySet, 3, [], buckets.get('factory_set_mdxi')!, 'factory_set_mdxi'),
  ];

  // ICU 插袋針子類
  const icuBagSpike = makeNode(
    'icu-bag', '插袋針 (Bag spike)', '插入點滴袋使用，皆加 R1-8112 針蓋',
    PALETTE.icuBag, 3,
    [
      makeNode('icu-bag-vp', '透氣-透氣口 (Side port)', '常見: R1-8026, R1-8027, R1-15460', PALETTE.icuBag, 4, [], buckets.get('customer_icu_bag_vented_port')!, 'customer_icu_bag_vented_port'),
      makeNode('icu-bag-vc', '透氣-有鼻子 (Clave)', '常見: R1-8028, R1-15456, RAW0000335', PALETTE.icuBag, 4, [], buckets.get('customer_icu_bag_vented_clave')!, 'customer_icu_bag_vented_clave'),
      makeNode('icu-bag-nv', '不透氣 (僅握把)', '常見: R1-8029, R1-8030, R1-8577', PALETTE.icuBag, 4, [], buckets.get('customer_icu_bag_nonvented')!, 'customer_icu_bag_nonvented'),
      makeNode('icu-bag-cap', '插袋針蓋 R1-8112', '防止針尖撞傷', PALETTE.icuBag, 4, [], buckets.get('customer_icu_bag_cap')!, 'customer_icu_bag_cap'),
    ],
    [], 'customer_icu_bag_vented_port',
  );

  // ICU 採藥針子類
  const icuVialSpike = makeNode(
    'icu-vial', '採藥針 (Vial spike)', '插入藥瓶使用，皆加 R1-15853 針蓋',
    PALETTE.icuVial, 3,
    [
      makeNode('icu-vial-nip', '奶嘴 (圓盤型)', '常見: R1-8391, R1-15951', PALETTE.icuVial, 4, [], buckets.get('customer_icu_vial_nipple')!, 'customer_icu_vial_nipple'),
      makeNode('icu-vial-9035', '9035 (兩個翅膀)', '零件 R1-9035 / 組件 R1-15935', PALETTE.icuVial, 4, [], buckets.get('customer_icu_vial_9035')!, 'customer_icu_vial_9035'),
      makeNode('icu-vial-flower', '花系列 (四個爪子)', '小花 20mm / 中花 28mm / 大花 32mm', PALETTE.icuVial, 4, [], buckets.get('customer_icu_vial_flower')!, 'customer_icu_vial_flower'),
      makeNode('icu-vial-cap', '採藥針蓋 R1-15853', '防止針尖撞傷', PALETTE.icuVial, 4, [], buckets.get('customer_icu_vial_cap')!, 'customer_icu_vial_cap'),
    ],
    [], 'customer_icu_vial_nipple',
  );

  // ICU 節點
  const icuNode = makeNode(
    'icu', 'ICU', '常見品號開頭: R1-, 27-, 75-, CIV-, RAW-',
    { bg: '#7C2D12', border: '#F97316', text: '#FED7AA' }, 2,
    [icuBagSpike, icuVialSpike],
    [],
  );

  // 廠內品號 Level-1 節點
  const factoryNode = makeNode(
    'factory', '廠內品號編碼介紹', 'Mouldex 自有品號體系',
    PALETTE.level1, 1,
    [
      makeNode('factory-part', '零件 (Component)', '九類基礎零件', PALETTE.factoryPart, 2, factoryPartNodes, []),
      makeNode('factory-asm', '組件 (Sub-assembly)', 'SA / SB / SC / SD 系列', PALETTE.factoryAsm, 2, factoryAsmNodes, []),
      makeNode('factory-set', 'Set', 'MDXE / MDXI 成套產品', PALETTE.factorySet, 2, factorySetNodes, []),
    ],
    [],
  );

  // 客戶品號 Level-1 節點
  const customerNode = makeNode(
    'customer', '客戶品號編碼介紹', 'ICU / BD / MPS / Biometrix / Vivus',
    PALETTE.level1, 1,
    [
      icuNode,
      makeNode('bd', 'BD', '購買 Set 及零件，以 BD 品號為主', PALETTE.customerBD, 2, [], buckets.get('customer_bd')!, 'customer_bd'),
      makeNode('mps', 'MPS', 'Set 以 MPS 品號下單，零件用廠內品號', PALETTE.customerBD, 2, [], buckets.get('customer_mps')!, 'customer_mps'),
      makeNode('biometrix', 'Biometrix', '購買 Set MDXE-093-01，需依標準製作標籤包裝', PALETTE.customerBD, 2, [], buckets.get('customer_biometrix')!, 'customer_biometrix'),
      makeNode('vivus', 'Vivus (動物使用)', '以廠內品號下單 MDXE-XXX，出貨用 Animalcare 品號', PALETTE.customerOther, 2, [], buckets.get('customer_vivus')!, 'customer_vivus'),
    ],
    [],
  );

  // 未分類節點
  const unclassifiedParts = buckets.get('unclassified')!;
  const unclassifiedNode = makeNode(
    'unclassified', '待人工分類', `${unclassifiedParts.length} 件品號等待對應`,
    PALETTE.unclassified, 1, [], unclassifiedParts, 'unclassified',
  );

  // 根節點
  return makeNode(
    'root',
    '凱益股份有限公司 產品識別教育訓練',
    '點擊節點展開/收合 · 點擊品號跳轉查詢',
    PALETTE.root, 0,
    [factoryNode, customerNode, unclassifiedNode],
    [],
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 遞迴收集所有節點 ID (用於搜尋展開路徑)
// ────────────────────────────────────────────────────────────────────────────

function collectMatchingIds(
  node: MindMapNode,
  query: string,
  ancestorIds: string[],
  result: Set<string>,
) {
  const q = query.toLowerCase();
  const selfMatch =
    node.label.toLowerCase().includes(q) ||
    node.sublabel?.toLowerCase().includes(q) ||
    node.parts.some(
      (p) =>
        p.partNo.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.customer || '').toLowerCase().includes(q),
    );

  if (selfMatch) {
    result.add(node.id);
    for (const id of ancestorIds) result.add(id);
  }

  for (const child of node.children) {
    collectMatchingIds(child, query, [...ancestorIds, node.id], result);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 遞迴計算節點下的品號總數
// ────────────────────────────────────────────────────────────────────────────
function countParts(node: MindMapNode): number {
  return node.parts.length + node.children.reduce((acc, c) => acc + countParts(c), 0);
}

// ────────────────────────────────────────────────────────────────────────────
// 單個 MindMap 節點組件
// ────────────────────────────────────────────────────────────────────────────

interface NodeProps {
  node: MindMapNode;
  searchQuery: string;
  expandedIds: Set<string>;
  highlightIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectPart?: (partNo: string) => void;
  scale: number;
}

const MindMapNodeComponent: React.FC<NodeProps> = ({
  node,
  searchQuery,
  expandedIds,
  highlightIds,
  onToggle,
  onSelectPart,
  scale,
}) => {
  const isExpanded = expandedIds.has(node.id);
  const isHighlighted = highlightIds.size > 0 && highlightIds.has(node.id);
  const hasChildren = node.children.length > 0;
  const hasParts = node.parts.length > 0;
  const totalParts = countParts(node);
  const isRoot = node.depth === 0;
  const isDimmed = highlightIds.size > 0 && !isHighlighted && !highlightIds.has(node.id);

  const q = searchQuery.trim().toLowerCase();

  const highlight = (text: string) => {
    if (!q || !text.toLowerCase().includes(q)) return text;
    const idx = text.toLowerCase().indexOf(q);
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-amber-400/70 text-black rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  // 字體大小按深度
  const labelSize = isRoot ? 'text-base font-bold' : node.depth === 1 ? 'text-sm font-bold' : 'text-xs font-semibold';

  return (
    <div className={`flex items-start gap-0 transition-opacity duration-200 ${isDimmed ? 'opacity-30' : 'opacity-100'}`}>
      {/* 節點本體 */}
      <div className="flex flex-col items-center">
        {/* 節點盒子 */}
        <div
          className={`
            relative flex flex-col rounded-xl border-2 cursor-pointer select-none
            transition-all duration-200 hover:brightness-125 active:scale-95 shadow-lg
            ${isHighlighted ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-950' : ''}
          `}
          style={{
            backgroundColor: node.color,
            borderColor: node.borderColor,
            minWidth: isRoot ? '240px' : node.depth === 1 ? '200px' : node.depth === 2 ? '170px' : '150px',
            maxWidth: isRoot ? '300px' : '240px',
            padding: isRoot ? '12px 16px' : node.depth <= 2 ? '8px 12px' : '6px 10px',
          }}
          onClick={() => (hasChildren || hasParts) && onToggle(node.id)}
        >
          <div className="flex items-center gap-2">
            <div className={`flex-1 ${labelSize}`} style={{ color: node.textColor }}>
              {highlight(node.label)}
            </div>
            {(hasChildren || hasParts) && (
              <div className="shrink-0 opacity-70" style={{ color: node.textColor }}>
                {isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5" />
                  : <ChevronRight className="w-3.5 h-3.5" />
                }
              </div>
            )}
          </div>
          {node.sublabel && (
            <div className="text-[10px] opacity-60 mt-0.5 leading-tight" style={{ color: node.textColor }}>
              {node.sublabel}
            </div>
          )}
          {/* 品號計數標籤 */}
          {totalParts > 0 && (
            <div
              className="absolute -top-2 -right-2 min-w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold shadow-md"
              style={{ backgroundColor: node.borderColor, color: '#fff' }}
            >
              {totalParts}
            </div>
          )}
        </div>

        {/* 展開後品號列表 */}
        {isExpanded && hasParts && (
          <div
            className="mt-2 rounded-xl border overflow-hidden w-full"
            style={{ borderColor: node.borderColor + '60', backgroundColor: '#0B1120' }}
          >
            <div className="max-h-72 overflow-y-auto">
              {node.parts
                .filter((p) =>
                  !q ||
                  p.partNo.toLowerCase().includes(q) ||
                  p.name.toLowerCase().includes(q) ||
                  (p.customer || '').toLowerCase().includes(q),
                )
                .map((part) => (
                  <div
                    key={part.partNo}
                    className="group flex items-start gap-2 px-3 py-2 hover:bg-white/5 transition-colors cursor-pointer border-b border-slate-800/50 last:border-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPart?.(part.partNo);
                    }}
                    title={`點擊查看 ${part.partNo} 詳情與 BOM`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-mono font-bold text-slate-200 truncate">
                        {highlight(part.partNo)}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate leading-tight">
                        {highlight(part.name)}
                        {part.customer ? ` · ${highlight(part.customer)}` : ''}
                      </div>
                    </div>
                    <Eye className="w-3 h-3 text-slate-600 group-hover:text-indigo-400 shrink-0 mt-0.5 transition-colors" />
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* 子節點 */}
      {isExpanded && hasChildren && (
        <div className="flex flex-col gap-2 ml-3 mt-0 pl-3 border-l-2 border-dashed" style={{ borderColor: node.borderColor + '60' }}>
          {node.children.map((child) => (
            <MindMapNodeComponent
              key={child.id}
              node={child}
              searchQuery={searchQuery}
              expandedIds={expandedIds}
              highlightIds={highlightIds}
              onToggle={onToggle}
              onSelectPart={onSelectPart}
              scale={scale}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// 主組件
// ────────────────────────────────────────────────────────────────────────────

export const ProductMindMapModal: React.FC<ProductMindMapModalProps> = ({
  isOpen,
  onClose,
  parts,
  onSelectPart,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['root', 'factory', 'customer']));
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const lastPan = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const mindMapTree = useMemo(() => buildMindMapTree(parts), [parts]);

  const [unclassifiedCount, classifiedCount] = useMemo(() => {
    let unclassified = 0;
    let classified = 0;
    for (const p of parts) {
      const r = classifyPart(p);
      if (r.category === 'unclassified') unclassified++;
      else classified++;
    }
    return [unclassified, classified];
  }, [parts]);

  // 搜尋命中的展開路徑
  const highlightIds = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return new Set<string>();
    const result = new Set<string>();
    collectMatchingIds(mindMapTree, q, [], result);
    return result;
  }, [mindMapTree, searchQuery]);

  // 有搜尋時，自動展開命中路徑
  useEffect(() => {
    if (highlightIds.size > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        for (const id of highlightIds) next.add(id);
        return next;
      });
    }
  }, [highlightIds]);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    const allIds = new Set<string>();
    const collect = (node: MindMapNode) => {
      allIds.add(node.id);
      node.children.forEach(collect);
    };
    collect(mindMapTree);
    setExpandedIds(allIds);
  }, [mindMapTree]);

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set(['root']));
  }, []);

  const handleResetView = useCallback(() => {
    setScale(1);
    setPanX(0);
    setPanY(0);
  }, []);

  // 拖曳 Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    lastPan.current = { x: e.clientX - panX, y: e.clientY - panY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !lastPan.current) return;
    setPanX(e.clientX - lastPan.current.x);
    setPanY(e.clientY - lastPan.current.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    lastPan.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => Math.max(0.3, Math.min(3, prev * delta)));
  };

  if (!isOpen) return null;

  const handleSelectPart = (partNo: string) => {
    onSelectPart?.(partNo);
    onClose();
  };

  return (
    <div className="fixed inset-0 w-screen h-screen z-50 bg-slate-950 flex flex-col overflow-hidden text-slate-100 select-none">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/90 gap-3 shrink-0 shadow-lg z-20 backdrop-blur-sm">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer active:scale-95"
            title="返回主系統"
          >
            <ArrowLeft className="w-4 h-4" />
            返回主系統
          </button>

          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              產品識別教育訓練 — 思維導圖
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                v5.0.0
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              已分類 <span className="text-emerald-400 font-bold">{classifiedCount}</span> 件 · 待分類 <span className="text-amber-400 font-bold">{unclassifiedCount}</span> 件 · 共 {parts.length} 件
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* 搜尋 */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋品號或名稱..."
              className="pl-8 pr-4 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 展開/收合 */}
          <button onClick={handleExpandAll} className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 cursor-pointer transition-all">
            全部展開
          </button>
          <button onClick={handleCollapseAll} className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 cursor-pointer transition-all">
            全部收合
          </button>

          {/* 縮放 */}
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
            <button onClick={() => setScale((p) => Math.min(3, p * 1.2))} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer transition-colors">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-400 w-10 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale((p) => Math.max(0.3, p * 0.83))} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer transition-colors">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <button onClick={handleResetView} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white cursor-pointer transition-all" title="重置視角">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── 操作提示 ── */}
      <div className="px-5 py-1.5 bg-slate-900/60 border-b border-slate-800/60 flex items-center gap-4 text-[11px] text-slate-500 shrink-0">
        <Info className="w-3 h-3 shrink-0" />
        <span>🖱️ 左鍵拖曳移動畫面 · 滾輪縮放 · 點擊節點展開/收合 · 點擊品號跳轉查詢</span>
        {searchQuery && highlightIds.size > 0 && (
          <span className="text-amber-400">
            找到 {highlightIds.size} 個匹配節點
          </span>
        )}
      </div>

      {/* ── Canvas Area ── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
            transformOrigin: '0 0',
            display: 'inline-block',
            padding: '40px 60px',
          }}
        >
          <MindMapNodeComponent
            node={mindMapTree}
            searchQuery={searchQuery}
            expandedIds={expandedIds}
            highlightIds={highlightIds}
            onToggle={handleToggle}
            onSelectPart={handleSelectPart}
            scale={scale}
          />
        </div>
      </div>
    </div>
  );
};
