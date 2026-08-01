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
  Layers,
  Eye,
  RotateCcw,
  Info,
  Image as ImageIcon,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { PartItem } from '../types';
import { classifyPart, MindMapCategory } from '../utils/mindmapClassifier';
import { ImageLibrary } from '../utils/imageLibrary';
import { resolveImage } from '../utils/imageResolver';

// ────────────────────────────────────────────────────────────────────────────
// Constants – 1× baseline (縮小為原 1.5× 的 1/1.5)
// ────────────────────────────────────────────────────────────────────────────

const CARD = {
  rootMinW:  240,
  d1MinW:    200,
  d2MinW:    170,
  d3MinW:    150,
  partMinW:  140,
  maxW:      280,
  rootPad:   '12px 16px',
  nodePad:   '8px 12px',
  leafPad:   '6px 10px',
  partPad:   '5px 8px',
};

const CONN = {
  horizontalLen: 19,
  lineW: 1,
  nodeHeaderH: 17,
};

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface MindMapNode {
  id: string;
  label: string;
  sublabel?: string;
  color: string;
  textColor: string;
  borderColor: string;
  children: MindMapNode[];
  parts: PartItem[];
  category?: MindMapCategory;
  depth: number;
  isPartNode?: boolean;
}

interface ThumbnailState {
  partNo: string;
  partName: string;
  customer: string;
  imageUrl: string | null;
  imageName: string | null;
  via: 'file' | 'binding' | 'ocr' | null;
  anchorX: number;
  anchorY: number;
}

interface ProductMindMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  parts: PartItem[];
  imageLib?: ImageLibrary | null;
  bindings?: Record<string, string>;
  ocrIndex?: Map<string, string>;
  onSelectPart?: (partNo: string) => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Colour palette (Morandi Dark)
// ────────────────────────────────────────────────────────────────────────────

const PALETTE = {
  root:          { bg: '#3B4A6B', border: '#6B7A9E', text: '#F0F4FF' },
  level1:        { bg: '#1E3A5F', border: '#3B82F6', text: '#93C5FD' },
  factoryPart:   { bg: '#134E4A', border: '#14B8A6', text: '#5EEAD4' },
  factoryAsm:    { bg: '#1E3A5F', border: '#60A5FA', text: '#BFDBFE' },
  factorySet:    { bg: '#3B0764', border: '#8B5CF6', text: '#C4B5FD' },
  icuBag:        { bg: '#7C2D12', border: '#F97316', text: '#FED7AA' },
  icuVial:       { bg: '#701A75', border: '#E879F9', text: '#F5D0FE' },
  customerBD:    { bg: '#1C3144', border: '#38BDF8', text: '#BAE6FD' },
  customerOther: { bg: '#1F2937', border: '#6B7280', text: '#D1D5DB' },
  unclassified:  { bg: '#2D2D2D', border: '#6B7280', text: '#9CA3AF' },
  partNode:      { bg: '#0F172A', border: '#334155', text: '#38BDF8' },
};

function createPartLeafNodes(partsList: PartItem[], depth: number): MindMapNode[] {
  return partsList.map((part) => ({
    id: `part-${part.partNo}`,
    label: part.partNo,
    sublabel: part.name + (part.customer ? ` (${part.customer})` : ''),
    color: PALETTE.partNode.bg,
    textColor: PALETTE.partNode.text,
    borderColor: PALETTE.partNode.border,
    children: [],
    parts: [part],
    depth,
    isPartNode: true,
  }));
}

function buildMindMapTree(parts: PartItem[]): MindMapNode {
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
    const r = classifyPart(part);
    buckets.get(r.category)!.push(part);
  }

  const n = (
    id: string, label: string, sublabel: string | undefined,
    palette: { bg: string; border: string; text: string }, depth: number,
    children: MindMapNode[], parts: PartItem[], cat?: MindMapCategory,
  ): MindMapNode => ({ id, label, sublabel, color: palette.bg, textColor: palette.text, borderColor: palette.border, children, parts, category: cat, depth });

  const leaf = (id: string, label: string, sub: string, cat: MindMapCategory, depth = 3): MindMapNode => {
    const catParts = buckets.get(cat)!;
    const partChildren = createPartLeafNodes(catParts, depth + 1);
    return n(id, label, sub, PALETTE.factoryPart, depth, partChildren, catParts, cat);
  };

  const factoryParts: MindMapNode[] = [
    leaf('ft-t',   'T接頭',              'A01 / A02 / A03',               'factory_part_t_connector'),
    leaf('ft-y',   'Y管',               'B05 / B06',                     'factory_part_y_connector'),
    leaf('ft-mll', '針基/轉式 (MLL)',   'C09 / C11',                     'factory_part_mll'),
    leaf('ft-fll', '針基/滑式 (FLL)',   'D09 / D10',                     'factory_part_fll'),
    leaf('ft-cap', '針基蓋',            'E09 / E10 / E11',               'factory_part_cap'),
    leaf('ft-clamp','夾具',             'F17 切斷器 / F18 夾緊器',       'factory_part_clamp'),
    leaf('ft-k',   '連接管 K系列',      'K07 U型 / K08 三通 / K27 四通', 'factory_part_k_connector'),
    leaf('ft-q',   '倒鉤式連接器 Q系列','Q09 MLL / Q10 FLL',            'factory_part_q_barbed'),
    leaf('ft-other','其他',             'G05 針筒蓋 / G13 插入針 / H00 螺帽','factory_part_other'),
  ];

  const asmLeaf = (id: string, label: string, sub: string, cat: MindMapCategory) => {
    const pList = buckets.get(cat)!;
    return n(id, label, sub, PALETTE.factoryAsm, 3, createPartLeafNodes(pList, 4), pList, cat);
  };

  const factoryAsm: MindMapNode[] = [
    asmLeaf('fa-sa', 'SA 系列', '2 pcs 組合', 'factory_asm_sa'),
    asmLeaf('fa-sb', 'SB 系列', '3 pcs 組合', 'factory_asm_sb'),
    asmLeaf('fa-sc', 'SC 系列', '4 pcs 組合', 'factory_asm_sc'),
    asmLeaf('fa-sd', 'SD 系列', '5 pcs 組合', 'factory_asm_sd'),
    asmLeaf('fa-sp', '特殊品號', '如 3M41459', 'factory_asm_special'),
  ];

  const setLeaf = (id: string, label: string, sub: string, cat: MindMapCategory) => {
    const pList = buckets.get(cat)!;
    return n(id, label, sub, PALETTE.factorySet, 3, createPartLeafNodes(pList, 4), pList, cat);
  };

  const factorySet: MindMapNode[] = [
    setLeaf('fs-mdxe', 'MDXE', 'Extension set（不含插入針）', 'factory_set_mdxe'),
    setLeaf('fs-mdxi', 'MDXI', 'I.V. set（含插入針）',       'factory_set_mdxi'),
  ];

  const icuLeaf = (id: string, label: string, sub: string, cat: MindMapCategory) => {
    const pList = buckets.get(cat)!;
    return n(id, label, sub, PALETTE.icuBag, 4, createPartLeafNodes(pList, 5), pList, cat);
  };

  const icuBagSpike = n('icu-bag', '插袋針 (Bag spike)', '插入點滴袋，皆加 R1-8112 針蓋', PALETTE.icuBag, 3, [
    icuLeaf('icu-bag-vp', '透氣-透氣口 (Side port)', '常見: R1-8026, R1-8027, R1-15460', 'customer_icu_bag_vented_port'),
    icuLeaf('icu-bag-vc', '透氣-有鼻子 (Clave)',    'R1-8028, R1-15456, RAW0000335',    'customer_icu_bag_vented_clave'),
    icuLeaf('icu-bag-nv', '不透氣 (僅握把)',        '常見: R1-8029, R1-8030, R1-8577',  'customer_icu_bag_nonvented'),
    icuLeaf('icu-bag-cap', '插袋針蓋 R1-8112',     '防止針尖撞傷',                      'customer_icu_bag_cap'),
  ], []);

  const icuVialLeaf = (id: string, label: string, sub: string, cat: MindMapCategory) => {
    const pList = buckets.get(cat)!;
    return n(id, label, sub, PALETTE.icuVial, 4, createPartLeafNodes(pList, 5), pList, cat);
  };

  const icuVialSpike = n('icu-vial', '採藥針 (Vial spike)', '插入藥瓶，皆加 R1-15853 針蓋', PALETTE.icuVial, 3, [
    icuVialLeaf('icu-vial-nip',   '奶嘴 (圓盤型)',      '常見: R1-8391, R1-15951',          'customer_icu_vial_nipple'),
    icuVialLeaf('icu-vial-9035',  '9035 (兩個翅膀)',    'R1-9035 / 組件 R1-15935',          'customer_icu_vial_9035'),
    icuVialLeaf('icu-vial-flower','花系列 (四個爪子)', '小花 20mm / 中花 28mm / 大花 32mm', 'customer_icu_vial_flower'),
    icuVialLeaf('icu-vial-cap',   '採藥針蓋 R1-15853', '防止針尖撞傷',                      'customer_icu_vial_cap'),
  ], []);

  const custLeaf = (id: string, label: string, sub: string, cat: MindMapCategory) => {
    const pList = buckets.get(cat)!;
    return n(id, label, sub, PALETTE.customerBD, 2, createPartLeafNodes(pList, 3), pList, cat);
  };

  const unclassParts = buckets.get('unclassified')!;

  return n('root', '凱益股份有限公司 產品識別教育訓練', '點擊節點展開/收合 · 點擊品號卡片查看縮圖', PALETTE.root, 0, [
    n('factory', '廠內品號編碼介紹', 'Mouldex 自有品號體系', PALETTE.level1, 1, [
      n('factory-part', '零件 (Component)', '九類基礎零件',        PALETTE.factoryPart, 2, factoryParts, []),
      n('factory-asm',  '組件 (Sub-assembly)', 'SA/SB/SC/SD 系列', PALETTE.factoryAsm, 2, factoryAsm, []),
      n('factory-set',  'Set', 'MDXE / MDXI 成套產品',            PALETTE.factorySet, 2, factorySet, []),
    ], []),
    n('customer', '客戶品號編碼介紹', 'ICU / BD / MPS / Biometrix / Vivus', PALETTE.level1, 1, [
      n('icu',       'ICU', '常見前綴: R1-, 27-, 75-, CIV-, RAW-', { bg: '#7C2D12', border: '#F97316', text: '#FED7AA' }, 2, [icuBagSpike, icuVialSpike], []),
      custLeaf('bd',       'BD',        '購買 Set 及零件，BD 品號下單',             'customer_bd'),
      custLeaf('mps',      'MPS',       'Set 以 MPS 品號下單，零件廠內品號',        'customer_mps'),
      custLeaf('biometrix','Biometrix', '購買 Set MDXE-093-01，依標準製作標籤包裝', 'customer_biometrix'),
      n('vivus',    'Vivus (動物使用)', '廠內品號下單 MDXE-XXX，Animalcare 品號出貨', PALETTE.customerOther, 2, createPartLeafNodes(buckets.get('customer_vivus')!, 3), buckets.get('customer_vivus')!, 'customer_vivus'),
    ], []),
    n('unclassified', '待人工分類', `${unclassParts.length} 件品號等待對應`, PALETTE.unclassified, 1, createPartLeafNodes(unclassParts, 2), unclassParts, 'unclassified'),
  ], []);
}

function collectMatchingIds(node: MindMapNode, query: string, ancestors: string[], result: Set<string>) {
  const q = query.toLowerCase();
  const selfMatch =
    node.label.toLowerCase().includes(q) ||
    node.sublabel?.toLowerCase().includes(q) ||
    node.parts.some(p => p.partNo.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || (p.customer||'').toLowerCase().includes(q));
  if (selfMatch) { result.add(node.id); ancestors.forEach(id => result.add(id)); }
  node.children.forEach(c => collectMatchingIds(c, query, [...ancestors, node.id], result));
}

function countParts(node: MindMapNode): number {
  if (node.isPartNode) return 1;
  return node.children.reduce((s, c) => s + countParts(c), 0);
}

// ────────────────────────────────────────────────────────────────────────────
// Thumbnail popup component
// ────────────────────────────────────────────────────────────────────────────

interface ThumbnailPopupProps {
  thumbnail: ThumbnailState;
  onClose: () => void;
  onNavigate: () => void;
}

const ThumbnailPopup: React.FC<ThumbnailPopupProps> = ({ thumbnail, onClose, onNavigate }) => {
  const [imgError, setImgError] = useState(false);
  const hasImage = !!thumbnail.imageUrl && !imgError;

  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(thumbnail.anchorX + 12, window.innerWidth - 260),
    top:  Math.max(Math.min(thumbnail.anchorY - 70, window.innerHeight - 340), 12),
    zIndex: 200,
    width: 240,
    animation: 'fadeInScale 0.18s ease-out forwards',
  };

  const viaBadge = thumbnail.via === 'file' ? '檔名比對' : thumbnail.via === 'binding' ? '手動綁定' : thumbnail.via === 'ocr' ? 'OCR辨識' : null;

  return (
    <>
      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.92) translateY(4px); }
          to   { opacity: 1; transform: scale(1)    translateY(0px); }
        }
      `}</style>
      <div style={style} className="rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-800/80">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[12px] font-mono font-bold text-indigo-300 truncate">{thumbnail.partNo}</span>
            {viaBadge && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                {viaBadge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onNavigate}
              title="跳轉至主頁查詢此品號 BOM"
              className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              title="關閉縮圖"
              className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Image area */}
        <div className="w-full h-48 flex items-center justify-center bg-slate-950 relative overflow-hidden">
          {hasImage ? (
            <div className="relative w-full h-full p-2 flex items-center justify-center">
              <img
                src={thumbnail.imageUrl!}
                alt={thumbnail.partNo}
                className="max-w-full max-h-full object-contain"
                onError={() => setImgError(true)}
              />
              {thumbnail.imageName && (
                <div className="absolute bottom-1 right-2 text-[9px] font-mono text-slate-500 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800 truncate maxWidth-[200px]">
                  {thumbnail.imageName}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-600 px-4 text-center">
              <ImageIcon className="w-10 h-10 opacity-40 text-slate-500" />
              <span className="text-[11px] text-slate-400 font-medium">尚無對應圖檔</span>
              <span className="text-[9.5px] text-slate-500 leading-tight">
                請在主系統點擊右上角「圖檔資料夾」選擇本機圖檔資料夾，或進行圖片手動綁定。
              </span>
            </div>
          )}
        </div>

        {/* Part info */}
        <div className="px-3 py-2 bg-slate-900 border-t border-slate-800">
          <div className="text-[11px] text-slate-200 font-medium leading-tight line-clamp-2">{thumbnail.partName || '—'}</div>
          {thumbnail.customer && (
            <div className="text-[10px] text-slate-400 mt-1">客戶：<span className="text-slate-300 font-semibold">{thumbnail.customer}</span></div>
          )}
        </div>
      </div>
    </>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// MindMap node component
// ────────────────────────────────────────────────────────────────────────────

interface NodeProps {
  node: MindMapNode;
  searchQuery: string;
  expandedIds: Set<string>;
  highlightIds: Set<string>;
  onToggle: (id: string) => void;
  onShowThumbnail: (part: PartItem, e: React.MouseEvent) => void;
  onSelectPart?: (partNo: string) => void;
}

const MindMapNodeComponent: React.FC<NodeProps> = ({
  node, searchQuery, expandedIds, highlightIds, onToggle, onShowThumbnail, onSelectPart,
}) => {
  const isExpanded    = expandedIds.has(node.id);
  const isHighlighted = highlightIds.size > 0 && highlightIds.has(node.id);
  const hasChildren   = node.children.length > 0;
  const totalParts    = countParts(node);
  const isRoot        = node.depth === 0;
  const isDimmed      = highlightIds.size > 0 && !isHighlighted;
  const q             = searchQuery.trim().toLowerCase();

  const highlight = (text: string): React.ReactNode => {
    if (!q || !text.toLowerCase().includes(q)) return text;
    const idx = text.toLowerCase().indexOf(q);
    return <>{text.slice(0, idx)}<mark className="bg-amber-400/70 text-black rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>{text.slice(idx + q.length)}</>;
  };

  if (node.isPartNode && node.parts.length > 0) {
    const part = node.parts[0];
    return (
      <div
        className={`
          group relative flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-2 cursor-pointer select-none shadow-md
          transition-all duration-150 hover:bg-slate-800 hover:border-indigo-500 hover:shadow-indigo-500/20 active:scale-[0.98]
          ${isDimmed ? 'opacity-30' : 'opacity-100'}
          ${isHighlighted ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950' : ''}
        `}
        style={{ minWidth: CARD.partMinW, maxWidth: CARD.maxW }}
        onClick={(e) => onShowThumbnail(part, e)}
        title={`點擊彈出 ${part.partNo} 縮圖`}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-mono font-bold text-sky-300 truncate group-hover:text-indigo-300 transition-colors">
            {highlight(part.partNo)}
          </div>
          <div className="text-[7.5px] text-slate-400 truncate leading-tight mt-0.5">
            {highlight(part.name)}{part.customer ? ` · ${highlight(part.customer)}` : ''}
          </div>
        </div>
        <div className="p-1 rounded-lg bg-slate-800 group-hover:bg-indigo-500/20 text-slate-500 group-hover:text-indigo-400 transition-colors shrink-0">
          <Eye className="w-3.5 h-3.5" />
        </div>
      </div>
    );
  }

  const labelClass = isRoot
    ? 'text-sm font-bold leading-snug'
    : node.depth === 1 ? 'text-[11px] font-bold leading-snug'
    : node.depth === 2 ? 'text-[10px] font-semibold leading-snug'
    : 'text-[9px] font-semibold leading-snug';

  const sublabelClass = isRoot ? 'text-[8px]' : 'text-[7.5px]';
  const minW = isRoot ? CARD.rootMinW : node.depth === 1 ? CARD.d1MinW : node.depth === 2 ? CARD.d2MinW : CARD.d3MinW;
  const padding = isRoot ? CARD.rootPad : node.depth <= 2 ? CARD.nodePad : CARD.leafPad;
  const connColor = node.borderColor + '90';

  return (
    <div className={`flex items-start transition-opacity duration-200 ${isDimmed ? 'opacity-30' : 'opacity-100'}`}>
      <div className="flex flex-col items-stretch" style={{ minWidth: minW }}>
        <div
          className={`
            relative flex flex-col rounded-2xl border-2 cursor-pointer select-none shadow-xl
            transition-all duration-150 hover:brightness-125 active:scale-[0.98]
            ${isHighlighted ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950' : ''}
          `}
          style={{ backgroundColor: node.color, borderColor: node.borderColor, maxWidth: CARD.maxW, padding }}
          onClick={() => hasChildren && onToggle(node.id)}
        >
          <div className="flex items-center gap-2">
            <div className={`flex-1 ${labelClass}`} style={{ color: node.textColor }}>
              {highlight(node.label)}
            </div>
            {hasChildren && (
              <div className="shrink-0 opacity-75" style={{ color: node.textColor }}>
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            )}
          </div>
          {node.sublabel && (
            <div className={`${sublabelClass} opacity-60 mt-1 leading-tight`} style={{ color: node.textColor }}>
              {node.sublabel}
            </div>
          )}
          {totalParts > 0 && (
            <div
              className="absolute -top-2 -right-2 min-w-[17px] h-[17px] rounded-full flex items-center justify-center text-[8px] font-bold shadow-lg"
              style={{ backgroundColor: node.borderColor, color: '#fff' }}
            >
              {totalParts}
            </div>
          )}
        </div>
      </div>

      {isExpanded && hasChildren && (() => {
        const childCount = node.children.length;
        return (
          <div
            className="flex flex-col"
            style={{ marginLeft: CONN.horizontalLen + 8, position: 'relative' }}
          >
            {childCount > 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: -CONN.horizontalLen,
                  top: CONN.nodeHeaderH,
                  bottom: CONN.nodeHeaderH,
                  width: CONN.lineW,
                  backgroundColor: connColor,
                  pointerEvents: 'none',
                }}
              />
            )}

            {node.children.map((child, idx) => (
              <div
                key={child.id}
                className="relative flex items-start"
                style={{ marginBottom: idx < childCount - 1 ? 10 : 0 }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: -CONN.horizontalLen,
                    top: CONN.nodeHeaderH,
                    width: CONN.horizontalLen,
                    height: CONN.lineW,
                    backgroundColor: connColor,
                    pointerEvents: 'none',
                  }}
                />
                <MindMapNodeComponent
                  node={child}
                  searchQuery={searchQuery}
                  expandedIds={expandedIds}
                  highlightIds={highlightIds}
                  onToggle={onToggle}
                  onShowThumbnail={onShowThumbnail}
                  onSelectPart={onSelectPart}
                />
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Main modal
// ────────────────────────────────────────────────────────────────────────────

export const ProductMindMapModal: React.FC<ProductMindMapModalProps> = ({
  isOpen, onClose, parts, imageLib, bindings = {}, ocrIndex = new Map(), onSelectPart,
}) => {
  const [searchQuery, setSearchQuery]     = useState('');
  const [expandedIds, setExpandedIds]     = useState<Set<string>>(new Set(['root', 'factory', 'customer', 'factory-part', 'icu', 'icu-bag', 'icu-vial']));
  const [panX, setPanX]                   = useState(0);
  const [panY, setPanY]                   = useState(0);
  const [isDragging, setIsDragging]       = useState(false);
  const [thumbnail, setThumbnail]         = useState<ThumbnailState | null>(null);
  const lastPan                           = useRef<{ x: number; y: number } | null>(null);
  const containerRef                      = useRef<HTMLDivElement>(null);

  const mindMapTree = useMemo(() => buildMindMapTree(parts), [parts]);

  const [unclassifiedCount, classifiedCount] = useMemo(() => {
    let u = 0, c = 0;
    for (const p of parts) { if (classifyPart(p).category === 'unclassified') u++; else c++; }
    return [u, c];
  }, [parts]);

  const highlightIds = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return new Set<string>();
    const r = new Set<string>();
    collectMatchingIds(mindMapTree, q, [], r);
    return r;
  }, [mindMapTree, searchQuery]);

  useEffect(() => {
    if (highlightIds.size > 0) {
      setExpandedIds(prev => { const n = new Set(prev); highlightIds.forEach(id => n.add(id)); return n; });
    }
  }, [highlightIds]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setThumbnail(null);
    setIsDragging(true);
    lastPan.current = { x: e.clientX - panX, y: e.clientY - panY };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !lastPan.current) return;
    setPanX(e.clientX - lastPan.current.x);
    setPanY(e.clientY - lastPan.current.y);
  };
  const handleMouseUp = () => { setIsDragging(false); lastPan.current = null; };

  // 核心解圖邏輯：使用整合的 resolveImage (檔名、手動綁定、OCR 內容)
  const handleShowThumbnail = useCallback((part: PartItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    
    const res = resolveImage(
      part.partNo,
      part.alternates,
      imageLib ?? null,
      bindings,
      ocrIndex,
    );

    setThumbnail({
      partNo: part.partNo,
      partName: part.name,
      customer: part.customer || '',
      imageUrl: res?.url ?? null,
      imageName: res?.name ?? null,
      via: res?.via ?? null,
      anchorX: rect.right,
      anchorY: rect.top + rect.height / 2,
    });
  }, [imageLib, bindings, ocrIndex]);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    const ids = new Set<string>();
    const walk = (node: MindMapNode) => { ids.add(node.id); node.children.forEach(walk); };
    walk(mindMapTree);
    setExpandedIds(ids);
  }, [mindMapTree]);

  const handleCollapseAll = useCallback(() => setExpandedIds(new Set(['root'])), []);
  const handleResetView    = useCallback(() => { setPanX(0); setPanY(0); }, []);

  if (!isOpen) return null;

  const handleNavigatePart = (partNo: string) => {
    onSelectPart?.(partNo);
    onClose();
  };

  const FIXED_SCALE = 1.0;

  return (
    <div className="fixed inset-0 w-screen h-screen z-50 bg-slate-950 flex flex-col overflow-hidden text-slate-100 select-none">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/90 gap-3 shrink-0 shadow-lg z-20 backdrop-blur-sm">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer active:scale-95"
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
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">v5.3.0</span>
            </h2>
            <p className="text-[11px] text-slate-400">
              已分類 <span className="text-emerald-400 font-bold">{classifiedCount}</span> 件 ·
              待分類 <span className="text-amber-400 font-bold">{unclassifiedCount}</span> 件 ·
              共 {parts.length} 件
            </p>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜尋品號或名稱..."
              className="pl-8 pr-4 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button onClick={handleExpandAll}  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 cursor-pointer transition-all">全部展開</button>
          <button onClick={handleCollapseAll} className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 cursor-pointer transition-all">全部收合</button>

          <button onClick={handleResetView} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white cursor-pointer transition-all" title="重置視角">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Hint bar ── */}
      <div className="px-5 py-1.5 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
        <div className="flex items-center gap-4">
          <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>🖱️ 左鍵拖曳移動畫面 · 點擊類別卡片展開/收合 · 點擊品號卡片彈出縮圖與跳轉 BOM</span>
          {searchQuery && highlightIds.size > 0 && (
            <span className="text-amber-400 font-medium">找到 {highlightIds.size} 個匹配節點</span>
          )}
        </div>
        {!imageLib && (
          <div className="flex items-center gap-1.5 text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[10.5px]">
            <Sparkles className="w-3 h-3 shrink-0" />
            <span>提示：請回主頁右上角「圖檔資料夾」載入本機圖片以顯示縮圖</span>
          </div>
        )}
      </div>

      {/* ── Canvas ── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${FIXED_SCALE})`,
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
            onShowThumbnail={handleShowThumbnail}
            onSelectPart={partNo => handleNavigatePart(partNo)}
          />
        </div>
      </div>

      {/* ── Thumbnail popup ── */}
      {thumbnail && (
        <ThumbnailPopup
          thumbnail={thumbnail}
          onClose={() => setThumbnail(null)}
          onNavigate={() => { handleNavigatePart(thumbnail.partNo); setThumbnail(null); }}
        />
      )}
    </div>
  );
};
