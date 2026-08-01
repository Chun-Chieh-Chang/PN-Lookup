import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  X,
  Search,
  ArrowLeft,
  Layers,
  Eye,
  Info,
  Image as ImageIcon,
  ExternalLink,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { Tree as D3Tree, TreeLinkDatum } from 'react-d3-tree';
import { PartItem } from '../types';
import { classifyPart, MindMapCategory } from '../utils/mindmapClassifier';
import { ImageLibrary } from '../utils/imageLibrary';
import { resolveImage } from '../utils/imageResolver';

// ────────────────────────────────────────────────────────────────────────────
// Constants – 1.2× baseline (原 1× × 1.2)
// ────────────────────────────────────────────────────────────────────────────

const CARD = {
  rootMinW:  288,
  d1MinW:    240,
  d2MinW:    204,
  d3MinW:    180,
  partMinW:  168,
  maxW:      336,
  rootPad:   '14px 19px',
  nodePad:   '10px 14px',
  leafPad:   '7px 12px',
  partPad:   '6px 10px',
};

const CONN = {
  horizontalLen: 23,
  lineW: 1,
  nodeHeaderH: 20,
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
// Colour palette (Light mode)
// ────────────────────────────────────────────────────────────────────────────

const PALETTE = {
  root:          { bg: '#EEF2FF', border: '#6366F1', text: '#1E1B4B' },   // 靛藍
  level1:        { bg: '#F0F9FF', border: '#0EA5E9', text: '#0C4A6E' },   // 天藍
  factoryPart:   { bg: '#F0FDF4', border: '#16A34A', text: '#14532D' },   // 翠綠
  factoryAsm:    { bg: '#EFF6FF', border: '#3B82F6', text: '#1E3A8A' },   // 藍
  factorySet:    { bg: '#FAF5FF', border: '#9333EA', text: '#3B0764' },   // 紫
  icuBag:        { bg: '#FFF7ED', border: '#F97316', text: '#7C2D12' },   // 橙
  icuVial:       { bg: '#FDF4FF', border: '#C026D3', text: '#701A75' },   // 洋紅
  customerBD:    { bg: '#F0F9FF', border: '#0284C7', text: '#0C4A6E' },   // 深天藍
  customerOther: { bg: '#F8FAFC', border: '#94A3B8', text: '#334155' },   // 灰藍
  unclassified:  { bg: '#F8FAFC', border: '#CBD5E1', text: '#64748B' },   // 淺灰
  partNode:      { bg: '#F8FAFC', border: '#CBD5E1', text: '#1E40AF' },   // 品號葉節點
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
    return n(id, label, sub, PALETTE.factoryPart, depth, [], catParts, cat);
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
    return n(id, label, sub, PALETTE.factoryAsm, 3, [], pList, cat);
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
    return n(id, label, sub, PALETTE.factorySet, 3, [], pList, cat);
  };

  const factorySet: MindMapNode[] = [
    setLeaf('fs-mdxe', 'MDXE', 'Extension set（不含插入針）', 'factory_set_mdxe'),
    setLeaf('fs-mdxi', 'MDXI', 'I.V. set（含插入針）',       'factory_set_mdxi'),
  ];

  const icuLeaf = (id: string, label: string, sub: string, cat: MindMapCategory) => {
    const pList = buckets.get(cat)!;
    return n(id, label, sub, PALETTE.icuBag, 4, [], pList, cat);
  };

  const icuBagSpike = n('icu-bag', '插袋針 (Bag spike)', '插入點滴袋，皆加 R1-8112 針蓋', PALETTE.icuBag, 3, [
    icuLeaf('icu-bag-vp', '透氣-透氣口 (Side port)', '常見: R1-8026, R1-8027, R1-15460', 'customer_icu_bag_vented_port'),
    icuLeaf('icu-bag-vc', '透氣-有鼻子 (Clave)',    'R1-8028, R1-15456, RAW0000335',    'customer_icu_bag_vented_clave'),
    icuLeaf('icu-bag-nv', '不透氣 (僅握把)',        '常見: R1-8029, R1-8030, R1-8577',  'customer_icu_bag_nonvented'),
    icuLeaf('icu-bag-cap', '插袋針蓋 R1-8112',     '防止針尖撞傷',                      'customer_icu_bag_cap'),
  ], []);

  const icuVialLeaf = (id: string, label: string, sub: string, cat: MindMapCategory) => {
    const pList = buckets.get(cat)!;
    return n(id, label, sub, PALETTE.icuVial, 4, [], pList, cat);
  };

  const icuVialSpike = n('icu-vial', '採藥針 (Vial spike)', '插入藥瓶，皆加 R1-15853 針蓋', PALETTE.icuVial, 3, [
    icuVialLeaf('icu-vial-nip',   '奶嘴 (圓盤型)',      '常見: R1-8391, R1-15951',          'customer_icu_vial_nipple'),
    icuVialLeaf('icu-vial-9035',  '9035 (兩個翅膀)',    'R1-9035 / 組件 R1-15935',          'customer_icu_vial_9035'),
    icuVialLeaf('icu-vial-flower','花系列 (四個爪子)', '小花 20mm / 中花 28mm / 大花 32mm', 'customer_icu_vial_flower'),
    icuVialLeaf('icu-vial-cap',   '採藥針蓋 R1-15853', '防止針尖撞傷',                      'customer_icu_vial_cap'),
  ], []);

  const custLeaf = (id: string, label: string, sub: string, cat: MindMapCategory) => {
    const pList = buckets.get(cat)!;
    return n(id, label, sub, PALETTE.customerBD, 2, [], pList, cat);
  };

  const unclassParts = buckets.get('unclassified')!;

  return n('root', '凱益股份有限公司 產品識別教育訓練', '點擊節點展開/收合 · 點擊品號卡片查看縮圖', PALETTE.root, 0, [
    n('factory', '廠內品號編碼介紹', 'Mouldex 自有品號體系', PALETTE.level1, 1, [
      n('factory-part', '零件 (Component)', '九類基礎零件',        PALETTE.factoryPart, 2, factoryParts, []),
      n('factory-asm',  '組件 (Sub-assembly)', 'SA/SB/SC/SD 系列', PALETTE.factoryAsm, 2, factoryAsm, []),
      n('factory-set',  'Set', 'MDXE / MDXI 成套產品',            PALETTE.factorySet, 2, factorySet, []),
    ], []),
    n('customer', '客戶品號編碼介紹', 'ICU / BD / MPS / Biometrix / Vivus', PALETTE.level1, 1, [
      n('icu',       'ICU', '常見前綴: R1-, 27-, 75-, CIV-, RAW-', { bg: '#FFF7ED', border: '#F97316', text: '#7C2D12' }, 2, [icuBagSpike, icuVialSpike], []),
      custLeaf('bd',       'BD',        '購買 Set 及零件，BD 品號下單',             'customer_bd'),
      custLeaf('mps',      'MPS',       'Set 以 MPS 品號下單，零件廠內品號',        'customer_mps'),
      custLeaf('biometrix','Biometrix', '購買 Set MDXE-093-01，依標準製作標籤包裝', 'customer_biometrix'),
      n('vivus',    'Vivus (動物使用)', '廠內品號下單 MDXE-XXX，Animalcare 品號出貨', PALETTE.customerOther, 2, [], buckets.get('customer_vivus')!, 'customer_vivus'),
    ], []),
    n('unclassified', '待人工分類', `${unclassParts.length} 件品號等待對應`, PALETTE.unclassified, 1, [
      n('unclassified-list', '待對應品號清單', `${unclassParts.length} 件待對應品號`, PALETTE.unclassified, 2, [], unclassParts, 'unclassified'),
    ], []),
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
  const isPdf = !!thumbnail.imageName && thumbnail.imageName.toLowerCase().endsWith('.pdf');
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
      <div style={style} className="rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[12px] font-mono font-bold text-indigo-700 truncate">{thumbnail.partNo}</span>
            {viaBadge && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                {viaBadge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onNavigate}
              title="跳轉至主頁查詢此品號 BOM"
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              title="關閉縮圖"
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Image area */}
        <div className="w-full h-48 flex items-center justify-center bg-slate-100 relative overflow-hidden">
          {hasImage ? (
            <div className="relative w-full h-full p-2 flex items-center justify-center">
              {isPdf ? (
                <iframe
                  src={thumbnail.imageUrl! + '#toolbar=0&navpanes=0&scrollbar=0&view=FitH'}
                  title={thumbnail.partNo}
                  className="w-full h-full border-0"
                  onError={() => setImgError(true)}
                />
              ) : (
                <img
                  src={thumbnail.imageUrl!}
                  alt={thumbnail.partNo}
                  className="max-w-full max-h-full object-contain"
                  onError={() => setImgError(true)}
                />
              )}
              {thumbnail.imageName && (
                <div className="absolute bottom-1 right-2 text-[9px] font-mono text-slate-400 bg-white/90 px-1.5 py-0.5 rounded border border-slate-200 truncate maxWidth-[200px]">
                  {thumbnail.imageName}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              <ImageIcon className="w-10 h-10 opacity-30 text-slate-400" />
              <span className="text-[11px] text-slate-500 font-medium">尚無對應圖檔</span>
              <span className="text-[9.5px] text-slate-400 leading-tight">
                請在主系統點擊右上角「圖檔資料夾」選擇本機圖檔資料夾，或進行圖片手動綁定。
              </span>
            </div>
          )}
        </div>

        {/* Part info */}
        <div className="px-3 py-2 bg-white border-t border-slate-200">
          <div className="text-[11px] text-slate-800 font-medium leading-tight line-clamp-2">{thumbnail.partName || '—'}</div>
          {thumbnail.customer && (
            <div className="text-[10px] text-slate-500 mt-1">客戶：<span className="text-slate-700 font-semibold">{thumbnail.customer}</span></div>
          )}
        </div>
      </div>
    </>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// react-d3-tree 資料轉換
// ────────────────────────────────────────────────────────────────────────────

interface D3TreeNode {
  name: string;
  _mmNode: MindMapNode;
  children?: D3TreeNode[];
}

function toD3Tree(node: MindMapNode): D3TreeNode {
  return {
    name: node.id,
    _mmNode: node,
    children: node.children.length > 0 ? node.children.map(toD3Tree) : undefined,
  };
}

function getNodeCardWidth(mmNode: MindMapNode): number {
  if (mmNode.isPartNode) return CARD.partMinW;
  return mmNode.depth === 0
    ? CARD.rootMinW
    : mmNode.depth === 1
    ? CARD.d1MinW
    : mmNode.depth === 2
    ? CARD.d2MinW
    : CARD.d3MinW;
}

// ────────────────────────────────────────────────────────────────────────────
// Main modal
// ────────────────────────────────────────────────────────────────────────────

export const ProductMindMapModal: React.FC<ProductMindMapModalProps> = ({
  isOpen, onClose, parts, imageLib, bindings = {}, ocrIndex = new Map(), onSelectPart,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [thumbnail, setThumbnail]     = useState<ThumbnailState | null>(null);
  const [treeKey, setTreeKey]         = useState(0);
  const containerRef                  = useRef<HTMLDivElement>(null);
  // react-d3-tree translate：等容器掛載後取真實高度置中
  const [treeTranslate, setTreeTranslate] = useState({ x: 80, y: 300 });

  const handleResetDefault = useCallback(() => {
    setSearchQuery('');
    setThumbnail(null);
    setTreeKey(prev => prev + 1);
    if (containerRef.current) {
      setTreeTranslate({ x: 80, y: containerRef.current.clientHeight / 2 });
    }
  }, []);

  React.useEffect(() => {
    if (containerRef.current) {
      setTreeTranslate({ x: 80, y: containerRef.current.clientHeight / 2 });
    }
  }, [isOpen]);

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

  // react-d3-tree 需要的：轉換樹狀資料
  const d3TreeData = useMemo(() => toD3Tree(mindMapTree), [mindMapTree]);

  // 解圖縮圖
  const handleShowThumbnail = useCallback((part: PartItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const res = resolveImage(part.partNo, part.alternates, imageLib ?? null, bindings, ocrIndex);
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

  // 自訂連接線繪製：讓線條由父卡片右緣 (source.y + sourceWidth) 延伸至子卡片左緣 (target.y)
  const customStepPath = useCallback((linkDatum: TreeLinkDatum) => {
    const { source, target } = linkDatum;
    const sourceNode = (source.data as unknown as D3TreeNode)._mmNode;
    const sourceWidth = getNodeCardWidth(sourceNode);

    // react-d3-tree 在 orientation="horizontal" 下：SVG X 軸為 y，SVG Y 軸為 x
    const startX = source.y + sourceWidth;
    const startY = source.x;
    const endX = target.y;
    const endY = target.x;

    const midX = startX + (endX - startX) / 2;

    return `M${startX},${startY} H${midX} V${endY} H${endX}`;
  }, []);

  if (!isOpen) return null;

  const handleNavigatePart = (partNo: string) => {
    onSelectPart?.(partNo);
    onClose();
  };

  // react-d3-tree renderCustomNodeElement：每個節點渲染成自訂卡片
  const renderNode = ({ nodeDatum, toggleNode }: {
    nodeDatum: D3TreeNode & { __rd3t: { collapsed: boolean } };
    toggleNode: () => void;
  }) => {
    const mm = nodeDatum._mmNode;
    const isCollapsed = nodeDatum.__rd3t?.collapsed ?? false;
    const hasChildren = (nodeDatum.children?.length ?? 0) > 0;
    const isHighlighted = highlightIds.size > 0 && highlightIds.has(mm.id);
    const isDimmed      = highlightIds.size > 0 && !isHighlighted;
    const totalParts    = countParts(mm);
    const q             = searchQuery.trim().toLowerCase();

    const highlight = (text: string): React.ReactNode => {
      if (!q || !text.toLowerCase().includes(q)) return text;
      const idx = text.toLowerCase().indexOf(q);
      return <>{text.slice(0, idx)}<mark style={{ background: 'rgba(251,191,36,0.7)', borderRadius: 3, padding: '0 2px' }}>{text.slice(idx, idx + q.length)}</mark>{text.slice(idx + q.length)}</>;
    };

    // 品號葉節點
    if (mm.isPartNode && mm.parts.length > 0) {
      const part = mm.parts[0];
      return (
        <foreignObject
          width={CARD.partMinW}
          height={48}
          x={0}
          y={-24}
          style={{ overflow: 'visible' }}
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            onClick={(e) => handleShowThumbnail(part, e)}
            title={`點擊彈出 ${part.partNo} 縮圖`}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'white', border: '1px solid #CBD5E1',
              borderRadius: 10, padding: '6px 10px', cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              opacity: isDimmed ? 0.3 : 1,
              outline: isHighlighted ? '2px solid #FBBF24' : 'none',
              outlineOffset: 2,
              width: CARD.partMinW, minWidth: CARD.partMinW, maxWidth: CARD.maxW,
              boxSizing: 'border-box',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#EEF2FF'; (e.currentTarget as HTMLDivElement).style.borderColor = '#818CF8'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'white'; (e.currentTarget as HTMLDivElement).style.borderColor = '#CBD5E1'; }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#3730A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {highlight(part.partNo)}
              </div>
              <div style={{ fontSize: 9, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                {highlight(part.name)}{part.customer ? ` · ${highlight(part.customer)}` : ''}
              </div>
            </div>
            <div style={{ padding: 4, borderRadius: 6, background: '#F1F5F9', color: '#94A3B8', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
          </div>
        </foreignObject>
      );
    }

    // 分類節點 / 含有品號的葉卡片
    const isRoot = mm.depth === 0;
    const hasParts = mm.parts.length > 0;
    const isLeafCategory = hasParts && (!nodeDatum.children || nodeDatum.children.length === 0);

    const displayedParts = q && hasParts
      ? mm.parts.filter(p =>
          p.partNo.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.customer || '').toLowerCase().includes(q) ||
          (p.alternates && p.alternates.some(a => a.toLowerCase().includes(q)))
        )
      : mm.parts;

    const fontSize = isRoot ? 16 : mm.depth === 1 ? 13 : mm.depth === 2 ? 12 : 11;
    const subFontSize = isRoot ? 10 : 9;
    const cardW = isLeafCategory ? 320 : getNodeCardWidth(mm);
    const padH = isRoot ? 19 : mm.depth <= 2 ? 14 : 12;
    const padV = isRoot ? 14 : mm.depth <= 2 ? 10 : 8;

    const listH = isLeafCategory ? Math.min(displayedParts.length * 42 + 10, 220) : 0;
    const baseHeaderH = mm.sublabel ? (padV * 2 + fontSize * 1.4 + subFontSize * 1.4 + 4) : (padV * 2 + fontSize * 1.4);
    const nodeH = isLeafCategory ? (baseHeaderH + listH + 24) : baseHeaderH;

    return (
      <foreignObject
        width={cardW}
        height={nodeH + 12}
        x={0}
        y={-(nodeH + 12) / 2}
        style={{ overflow: 'visible' }}
      >
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          onClick={() => hasChildren && toggleNode()}
          style={{
            position: 'relative',
            display: 'flex', flexDirection: 'column',
            background: mm.color, border: `2px solid ${mm.borderColor}`,
            borderRadius: 16, padding: `${padV}px ${padH}px`,
            cursor: hasChildren ? 'pointer' : 'default',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            opacity: isDimmed ? 0.3 : 1,
            outline: isHighlighted ? '2px solid #FBBF24' : 'none',
            outlineOffset: 2,
            width: cardW, minWidth: cardW, maxWidth: CARD.maxW,
            boxSizing: 'border-box',
            transition: 'filter 0.15s',
            userSelect: 'none',
          }}
          onMouseEnter={e => { if (hasChildren) (e.currentTarget as HTMLDivElement).style.filter = 'brightness(0.98)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.filter = ''; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, fontSize, fontWeight: isRoot ? 700 : mm.depth <= 1 ? 700 : 600, color: mm.textColor, lineHeight: 1.3 }}>
              {highlight(mm.label)}
            </div>
            {hasChildren && (
              <div style={{ color: mm.textColor, opacity: 0.75, flexShrink: 0 }}>
                {isCollapsed
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                }
              </div>
            )}
          </div>
          {mm.sublabel && (
            <div style={{ fontSize: subFontSize, color: mm.textColor, opacity: 0.6, marginTop: 3, lineHeight: 1.3 }}>
              {mm.sublabel}
            </div>
          )}

          {/* 卷軸品號清單區塊 (Scrollable Part List Container) */}
          {isLeafCategory && (
            <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px solid ${mm.borderColor}40` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: mm.textColor, opacity: 0.85 }}>
                  品號列表 ({displayedParts.length} / {mm.parts.length})
                </span>
              </div>
              <div
                className="custom-scrollbar"
                onWheel={(e) => e.stopPropagation()}
                style={{
                  maxHeight: 220,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  paddingRight: 2,
                }}
              >
                {displayedParts.length === 0 ? (
                  <div style={{ fontSize: 10, color: '#94A3B8', textAlign: 'center', padding: '10px 0' }}>
                    無匹配品號
                  </div>
                ) : (
                  displayedParts.map((part) => (
                    <div
                      key={part.id || part.partNo}
                      onClick={(e) => { e.stopPropagation(); handleShowThumbnail(part, e); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: 8,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background = '#EEF2FF';
                        (e.currentTarget as HTMLDivElement).style.borderColor = '#818CF8';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background = '#FFFFFF';
                        (e.currentTarget as HTMLDivElement).style.borderColor = '#CBD5E1';
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
                        <div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#3730A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {highlight(part.partNo)}
                        </div>
                        <div style={{ fontSize: 9, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {highlight(part.name)}{part.customer ? ` · ${highlight(part.customer)}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleShowThumbnail(part, e); }}
                          title="預覽圖檔"
                          style={{ padding: 3, borderRadius: 5, background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#4945FF', cursor: 'pointer' }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleNavigatePart(part.partNo); }}
                          title="跳轉至 BOM 主頁"
                          style={{ padding: 3, borderRadius: 5, background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#059669', cursor: 'pointer' }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {totalParts > 0 && !isLeafCategory && (
            <div style={{
              position: 'absolute', top: -8, right: -8,
              minWidth: 20, height: 20, borderRadius: '50%',
              background: mm.borderColor, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }}>
              {totalParts}
            </div>
          )}
        </div>
      </foreignObject>
    );
  };

  return (
    <div className="fixed inset-0 w-screen h-screen z-50 bg-slate-50 flex flex-col overflow-hidden text-slate-900 select-none">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-slate-200 bg-white gap-3 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            返回主系統
          </button>
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              產品識別教育訓練 — 思維導圖
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-indigo-50 text-indigo-600 border border-indigo-200">v5.4.0</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              已分類 <span className="text-emerald-600 font-bold">{classifiedCount}</span> 件 ·
              待分類 <span className="text-amber-600 font-bold">{unclassifiedCount}</span> 件 ·
              共 {parts.length} 件
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜尋品號或名稱..."
              className="pl-8 pr-4 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 w-48 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-xs"
            title="一鍵重置畫面視角並返回預設收合狀態"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>返回預設狀態</span>
          </button>
        </div>
      </div>

      {/* ── Hint bar ── */}
      <div className="px-5 py-1.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
        <div className="flex items-center gap-4">
          <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span>🖱️ 拖曳移動畫面 · 點擊類別卡片展開/收合 · 點擊品號卡片彈出縮圖</span>
          {searchQuery && highlightIds.size > 0 && (
            <span className="text-amber-600 font-semibold">找到 {highlightIds.size} 個匹配節點</span>
          )}
        </div>
        {!imageLib && (
          <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10.5px]">
            <Sparkles className="w-3 h-3 shrink-0" />
            <span>提示：請回主頁右上角「圖檔資料夾」載入本機圖片以顯示縮圖</span>
          </div>
        )}
      </div>

      {/* ── Canvas (react-d3-tree) ── */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative" onClick={() => setThumbnail(null)}>
        <D3Tree
          key={treeKey}
          data={d3TreeData}
          orientation="horizontal"
          pathFunc={customStepPath}
          separation={{ siblings: 1.5, nonSiblings: 2.0 }}
          nodeSize={{ x: 360, y: 130 }}
          renderCustomNodeElement={(rd3tProps) => renderNode(rd3tProps as never)}
          translate={treeTranslate}
          zoom={1}
          zoomable={false}
          enableLegacyTransitions={false}
          collapsible={true}
          initialDepth={1}
          pathClassFunc={() => 'mindmap-link'}
          svgClassName="mindmap-svg"
        />
        <style>{`
          .mindmap-svg { width: 100%; height: 100%; }
          .mindmap-link { fill: none; stroke: #CBD5E1; stroke-width: 1.5px; }
          .rd3t-leaf-node circle, .rd3t-branch-node circle { display: none; }
          .rd3t-label__title, .rd3t-label__attributes-list { display: none; }
        `}</style>
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
