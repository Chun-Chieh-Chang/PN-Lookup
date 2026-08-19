import { PartItem } from '../types';
import { classifyPart, MindMapCategory } from './mindmapClassifier';

// ────────────────────────────────────────────────────────────────────────────
// 產品思維導圖樹結構（基於實際 Master Table）
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
  partCount?: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Colour palette (Glacier Workbench Theme)
// ────────────────────────────────────────────────────────────────────────────

export const PALETTE = {
  root:          { bg: '#e0f2fe', border: '#0284c7', text: '#0c4a6e' },   // Cobalt Blue
  assembly:      { bg: '#f0f9ff', border: '#0ea5e9', text: '#0c4a6e' },   // Sky
  factoryPart:   { bg: '#f0fdf4', border: '#16a34a', text: '#14532d' },   // Emerald
  material:      { bg: '#f1f5f9', border: '#64748b', text: '#334155' },   // Slate
  unclassified:  { bg: '#f8fafc', border: '#cbd5e1', text: '#64748b' },   // Gray
};

// ────────────────────────────────────────────────────────────────────────────
// 從 Master Table 建構思維導圖
// ────────────────────────────────────────────────────────────────────────────

interface PartMap {
  [partNo: string]: PartItem;
}

export function buildMindMapTree(parts: PartItem[], bomChildren: Record<string, string[]> = {}): MindMapNode {
  // 建立品號查找表
  const partMap: PartMap = {};
  parts.forEach(p => { partMap[p.partNo] = p; });

  // 分組：組件 vs 零件
  const assemblySet = new Set(Object.keys(bomChildren));
  const assemblyParts: PartItem[] = [];
  const leafParts: PartItem[] = [];

  parts.forEach(p => {
    if (assemblySet.has(p.partNo)) {
      assemblyParts.push(p);
    } else {
      leafParts.push(p);
    }
  });

  // 構建組件節點
  const assemblyNodes = assemblyParts.map(p => buildAssemblyNode(p.partNo, partMap, bomChildren, 1));

  // 構建零件節點（按分類分組）
  const classifiedParts = new Map<MindMapCategory, PartItem[]>();
  const catList: MindMapCategory[] = [
    'factory_part_t_connector', 'factory_part_y_connector', 'factory_part_mll',
    'factory_part_fll', 'factory_part_cap', 'factory_part_clamp', 'factory_part_other',
    'factory_part_k_connector', 'factory_part_q_barbed',
    'customer_icu_bag_vented_port', 'customer_icu_bag_vented_clave',
    'customer_icu_bag_nonvented', 'customer_icu_bag_cap',
    'customer_icu_vial_nipple', 'customer_icu_vial_9035',
    'customer_icu_vial_flower', 'customer_icu_vial_cap',
    'customer_bd', 'customer_mps', 'customer_biometrix', 'customer_vivus',
    'unclassified',
  ];
  for (const cat of catList) classifiedParts.set(cat, []);
  
  leafParts.forEach(part => {
    const r = classifyPart(part);
    if (!classifiedParts.has(r.category)) {
      classifiedParts.set(r.category, []);
    }
    classifiedParts.get(r.category)!.push(part);
  });

  // 構建零件節點（只保留有零件的分類）
  const leafNodes = catList
    .filter(cat => classifiedParts.get(cat)?.length > 0)
    .map(cat => buildLeafNode(cat, classifiedParts.get(cat)!, partMap, 1));

  // 構建根節點
  return {
    id: 'root',
    label: '產品識別教育訓練',
    sublabel: `共 ${parts.length} 個品號 · ${assemblyParts.length} 組組件 · 點擊展開`,
    color: PALETTE.root.bg,
    textColor: PALETTE.root.text,
    borderColor: PALETTE.root.border,
    children: [...assemblyNodes, ...leafNodes],
    parts: [],
    depth: 0,
    partCount: parts.length,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 構建組件節點（遞迴）
// ────────────────────────────────────────────────────────────────────────────

function buildAssemblyNode(
  assemblyId: string,
  partMap: PartMap,
  bomChildren: Record<string, string[]>,
  depth: number
): MindMapNode {
  const assembly = partMap[assemblyId];
  if (!assembly) {
    // 未登錄組件
    return {
      id: assemblyId,
      label: assemblyId,
      sublabel: '未登錄組件',
      color: PALETTE.unclassified.bg,
      textColor: PALETTE.unclassified.text,
      borderColor: PALETTE.unclassified.border,
      children: [],
      parts: [],
      depth,
      partCount: 0,
    };
  }

  const children = bomChildren[assemblyId] || [];
  const childNodes = children
    .filter(childId => !!partMap[childId]) // 過濾掉未登錄的
    .map(childId => {
      const childAssembly = partMap[childId];
      if (!childAssembly) return null;
      
      // 如果子件也是組件，遞迴處理
      if ((bomChildren[childId]?.length ?? 0) > 0) {
        return buildAssemblyNode(childId, partMap, bomChildren, depth + 1);
      } else {
        return buildLeafNodeFromPart(childId, partMap, depth + 1);
      }
    })
    .filter(Boolean);

  const totalParts = countPartsInSubtree(children, bomChildren);

  return {
    id: assemblyId,
    label: assembly.name || assemblyId,
    sublabel: `${assembly.customer || ''} · ${children.length} 個子件`,
    color: PALETTE.assembly.bg,
    textColor: PALETTE.assembly.text,
    borderColor: PALETTE.assembly.border,
    children: childNodes,
    parts: [assembly],
    depth,
    partCount: totalParts,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 構建零件節點（葉節點）
// ────────────────────────────────────────────────────────────────────────────

function buildLeafNode(
  category: MindMapCategory,
  categoryParts: PartItem[],
  partMap: PartMap,
  depth: number
): MindMapNode {
  return {
    id: `leaf-${category}`,
    label: getLabelForCategory(category),
    sublabel: `${categoryParts.length} 個品號`,
    color: getCategoryColor(category).bg,
    textColor: getCategoryColor(category).text,
    borderColor: getCategoryColor(category).border,
    children: categoryParts.map(p => buildLeafNodeFromPart(p.partNo, partMap, depth + 1)),
    parts: categoryParts,
    category,
    depth,
    partCount: categoryParts.length,
  };
}

function buildLeafNodeFromPart(
  partNo: string,
  partMap: PartMap,
  depth: number
): MindMapNode {
  const part = partMap[partNo];
  if (!part) {
    return {
      id: partNo,
      label: partNo,
      sublabel: '未登錄',
      color: PALETTE.unclassified.bg,
      textColor: PALETTE.unclassified.text,
      borderColor: PALETTE.unclassified.border,
      children: [],
      parts: [],
      depth,
      partCount: 0,
    };
  }

  const classification = classifyPart(part);
  
  return {
    id: partNo,
    label: part.name || partNo,
    sublabel: `${part.customer || ''} · ${part.material || ''}`,
    color: getCategoryColor(classification.category).bg,
    textColor: getCategoryColor(classification.category).text,
    borderColor: getCategoryColor(classification.category).border,
    children: [],
    parts: [part],
    category: classification.category,
    depth,
    partCount: 1,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 輔助函數
// ────────────────────────────────────────────────────────────────────────────

function countPartsInSubtree(
  partNos: string[],
  bomChildren: Record<string, string[]>
): number {
  let count = 0;
  const visited = new Set<string>();
  
  function dfs(pn: string) {
    if (visited.has(pn)) return;
    visited.add(pn);
    count++;
    (bomChildren[pn] || []).forEach(child => dfs(child));
  }
  
  partNos.forEach(pn => dfs(pn));
  return count;
}

function getLabelForCategory(category: MindMapCategory): string {
  const labels: Record<MindMapCategory, string> = {
    factory_part_t_connector: 'T 接頭 (A01~A03)',
    factory_part_y_connector: 'Y 管 (B05~B06)',
    factory_part_mll: '針基/轉式 (C09~C11)',
    factory_part_fll: '針基/滑式 (D09~D10)',
    factory_part_cap: '針基蓋 (E09~E11)',
    factory_part_clamp: '夾具 (F17~F18)',
    factory_part_other: '其他零件 (G/H)',
    factory_part_k_connector: '連接管 K 系列',
    factory_part_q_barbed: '倒鉤式 Q 系列',
    factory_asm_sa: 'SA 組件 (2 pcs)',
    factory_asm_sb: 'SB 組件 (3 pcs)',
    factory_asm_sc: 'SC 組件 (4 pcs)',
    factory_asm_sd: 'SD 組件 (5 pcs)',
    factory_asm_special: '特殊組件',
    factory_set_mdxe: 'MDXE Extension Set',
    factory_set_mdxi: 'MDXI I.V. Set',
    customer_icu_bag_vented_port: '插袋針 - 透氣口',
    customer_icu_bag_vented_clave: '插袋針 - 有鼻子',
    customer_icu_bag_nonvented: '插袋針 - 不透氣',
    customer_icu_bag_cap: '插袋針蓋 (R1-8112)',
    customer_icu_vial_nipple: '採藥針 - 奶嘴型',
    customer_icu_vial_9035: '採藥針 - 9035 型',
    customer_icu_vial_flower: '採藥針 - 花型',
    customer_icu_vial_cap: '採藥針蓋 (R1-15853)',
    customer_bd: 'BD 客戶品號',
    customer_mps: 'MPS 客戶品號',
    customer_biometrix: 'Biometrix 客戶品號',
    customer_vivus: 'Vivus 客戶品號',
    unclassified: '待分類',
  };
  return labels[category] || category;
}

function getCategoryColor(category: MindMapCategory): { bg: string; text: string; border: string } {
  const colors: Record<MindMapCategory, { bg: string; text: string; border: string }> = {
    factory_part_t_connector: PALETTE.factoryPart,
    factory_part_y_connector: PALETTE.factoryPart,
    factory_part_mll: PALETTE.factoryPart,
    factory_part_fll: PALETTE.factoryPart,
    factory_part_cap: PALETTE.factoryPart,
    factory_part_clamp: PALETTE.factoryPart,
    factory_part_other: PALETTE.factoryPart,
    factory_part_k_connector: PALETTE.factoryPart,
    factory_part_q_barbed: PALETTE.factoryPart,
    factory_asm_sa: PALETTE.assembly,
    factory_asm_sb: PALETTE.assembly,
    factory_asm_sc: PALETTE.assembly,
    factory_asm_sd: PALETTE.assembly,
    factory_asm_special: PALETTE.assembly,
    factory_set_mdxe: PALETTE.assembly,
    factory_set_mdxi: PALETTE.assembly,
    customer_icu_bag_vented_port: PALETTE.assembly,
    customer_icu_bag_vented_clave: PALETTE.assembly,
    customer_icu_bag_nonvented: PALETTE.assembly,
    customer_icu_bag_cap: PALETTE.assembly,
    customer_icu_vial_nipple: PALETTE.assembly,
    customer_icu_vial_9035: PALETTE.assembly,
    customer_icu_vial_flower: PALETTE.assembly,
    customer_icu_vial_cap: PALETTE.assembly,
    customer_bd: PALETTE.assembly,
    customer_mps: PALETTE.assembly,
    customer_biometrix: PALETTE.assembly,
    customer_vivus: PALETTE.assembly,
    unclassified: PALETTE.unclassified,
  };
  return colors[category] || PALETTE.unclassified;
}

// ────────────────────────────────────────────────────────────────────────────
// 搜尋函數
// ────────────────────────────────────────────────────────────────────────────

export function collectMatchingIds(node: MindMapNode, query: string, ancestors: string[], result: Set<string>) {
  const q = query.toLowerCase();
  const selfMatch =
    node.label.toLowerCase().includes(q) ||
    node.sublabel?.toLowerCase().includes(q) ||
    node.parts.some(p => 
      p.partNo.toLowerCase().includes(q) || 
      p.name.toLowerCase().includes(q) || 
      (p.customer || '').toLowerCase().includes(q)
    );
  
  if (selfMatch) {
    result.add(node.id);
    ancestors.forEach(id => result.add(id));
  }
  
  node.children.forEach(c => collectMatchingIds(c, query, [...ancestors, node.id], result));
}

// ────────────────────────────────────────────────────────────────────────────
// 統計函數
// ────────────────────────────────────────────────────────────────────────────

export function countParts(node: MindMapNode): number {
  if (node.partCount !== undefined) return node.partCount;
  return node.children.reduce((s, c) => s + countParts(c), 0);
}
