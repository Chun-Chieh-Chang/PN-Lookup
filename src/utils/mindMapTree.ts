import { PartItem } from '../types';
import { classifyPart, MindMapCategory } from './mindmapClassifier';

// ────────────────────────────────────────────────────────────────────────────
// 產品思維導圖樹結構（2D / 3D 共用）
// ────────────────────────────────────────────────────────────────────────────

export interface MindMapNode {
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

// ────────────────────────────────────────────────────────────────────────────
// Colour palette (Light mode)
// ────────────────────────────────────────────────────────────────────────────

export const PALETTE = {
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

export function buildMindMapTree(parts: PartItem[]): MindMapNode {
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

export function collectMatchingIds(node: MindMapNode, query: string, ancestors: string[], result: Set<string>) {
  const q = query.toLowerCase();
  const selfMatch =
    node.label.toLowerCase().includes(q) ||
    node.sublabel?.toLowerCase().includes(q) ||
    node.parts.some(p => p.partNo.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || (p.customer||'').toLowerCase().includes(q));
  if (selfMatch) { result.add(node.id); ancestors.forEach(id => result.add(id)); }
  node.children.forEach(c => collectMatchingIds(c, query, [...ancestors, node.id], result));
}

export function countParts(node: MindMapNode): number {
  if (node.isPartNode) return 1;
  return node.children.reduce((s, c) => s + countParts(c), 0);
}
