import { PartItem } from '../types';
import { MindMapCategory } from './mindmapClassifier';

// ────────────────────────────────────────────────────────────────────────────
// 產品思維導圖樹結構（教育訓練：原料→物料→零件→組件→Set）
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
}

// ────────────────────────────────────────────────────────────────────────────
// Colour palette (Glacier Workbench Theme)
// ────────────────────────────────────────────────────────────────────────────

export const PALETTE = {
  root:        { bg: '#e0f2fe', border: '#0284c7', text: '#0c4a6e' },   // Cobalt Blue
  raw:         { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },   // Amber - 原料
  material:    { bg: '#f1f5f9', border: '#64748b', text: '#334155' },   // Slate - 物料
  part:        { bg: '#f0fdf4', border: '#16a34a', text: '#14532d' },   // Emerald - 零件
  assembly:    { bg: '#eff6ff', border: '#3b82f6', text: '#1e3a8a' },   // Blue - 組件
  set:         { bg: '#faf5ff', border: '#9333ea', text: '#3b0764' },   // Purple - Set
  customer:    { bg: '#fff7ed', border: '#f97316', text: '#7c2d12' },   // Orange - 客戶
  unclassified:{ bg: '#f8fafc', border: '#cbd5e1', text: '#64748b' },   // Gray
};

// ────────────────────────────────────────────────────────────────────────────
// 從 Master Table 建構思維導圖
// ────────────────────────────────────────────────────────────────────────────

type MaterialGroup = 'raw' | 'material' | 'part' | 'assembly' | 'set';

// 判斷品號的材質/類型分組
function getMaterialGroup(part: PartItem): MaterialGroup {
  const cat = part.category || '';
  
  // 物料類別（原料、耗材等）
  if (cat === '物料') return 'material';
  
  // Set 類別（MDXE/MDXI）
  if (part.partNo.startsWith('MDXE-') || part.partNo.startsWith('MDXI-')) {
    return 'set';
  }
  
  // 組件類別（SA/SB/SC/SD + 其他組立）
  if (cat.includes('組立') || 
      part.partNo.startsWith('SA') || 
      part.partNo.startsWith('SB') || 
      part.partNo.startsWith('SC') || 
      part.partNo.startsWith('SD')) {
    return 'assembly';
  }
  
  // 特殊組件（3M41459 等）
  if (part.partNo === '3M41459' || part.partNo.startsWith('R1-2392') || part.partNo.startsWith('R1-3529')) {
    return 'assembly';
  }
  
  // ICU 插袋針/採藥針（客戶零件）
  if (part.partNo.startsWith('R1-') || part.partNo.startsWith('27-') || 
      part.partNo.startsWith('75-') || part.partNo.startsWith('CIV') || 
      part.partNo.startsWith('RAW')) {
    return 'part';
  }
  
  // 一般廠內零件
  return 'part';
}

// 獲取客戶類別
function getCustomerSubCategory(part: PartItem): string | null {
  const customer = (part.customer || '').toUpperCase();
  
  if (customer.includes('ICU')) return 'ICU';
  if (customer.includes('BD')) return 'BD';
  if (customer.includes('MPS')) return 'MPS';
  if (customer.includes('BIOMETRIX')) return 'Biometrix';
  if (customer.includes('VIVUS') || customer.includes('ANIMALCARE')) return 'Vivus';
  
  return null;
}

export function buildMindMapTree(parts: PartItem[]): MindMapNode {
  // 按材質分組
  const groups: Record<MaterialGroup, PartItem[]> = {
    raw: [],
    material: [],
    part: [],
    assembly: [],
    set: [],
  };
  
  // 客戶分組
  const customerGroups: Record<string, PartItem[]> = {
    'ICU': [],
    'BD': [],
    'MPS': [],
    'Biometrix': [],
    'Vivus': [],
  };
  
  // 未分類
  const unclassified: PartItem[] = [];
  
  parts.forEach(part => {
    const group = getMaterialGroup(part);
    groups[group].push(part);
    
    // 檢查是否為客戶品號
    const custCat = getCustomerSubCategory(part);
    if (custCat && customerGroups[custCat]) {
      customerGroups[custCat].push(part);
    }
  });
  
  // 構建節點的輔助函數
  const n = (
    id: string, 
    label: string, 
    sublabel: string | undefined,
    palette: typeof PALETTE.root, 
    depth: number,
    children: MindMapNode[],
    partItems: PartItem[],
    cat?: MindMapCategory,
  ): MindMapNode => ({
    id, label, sublabel,
    color: palette.bg,
    textColor: palette.text,
    borderColor: palette.border,
    children,
    parts: partItems,
    category: cat,
    depth,
  });
  
  // 構建零件分組（按前綴分類顯示）
  const buildPartNodes = (partList: PartItem[], depth: number = 2): MindMapNode[] => {
    const byPrefix: Record<string, PartItem[]> = {};
    partList.forEach(p => {
      const prefix = p.partNo.split('-')[0];
      if (!byPrefix[prefix]) byPrefix[prefix] = [];
      byPrefix[prefix].push(p);
    });
    
    return Object.entries(byPrefix)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 20) // 限制顯示數量
      .map(([prefix, prefixParts]) => 
        n(`part-${prefix}`, prefix, `${prefixParts.length} 個品號`, PALETTE.part, depth, [], prefixParts)
      );
  };
  
  // 構建客戶子分組
  const buildCustomerNodes = (): MindMapNode[] => {
    const nodes: MindMapNode[] = [];
    
    Object.entries(customerGroups).forEach(([custName, custParts]) => {
      if (custParts.length > 0) {
        // 進一步按前綴分類
        const byPrefix: Record<string, PartItem[]> = {};
        custParts.forEach(p => {
          const prefix = p.partNo.split('-')[0];
          if (!byPrefix[prefix]) byPrefix[prefix] = [];
          byPrefix[prefix].push(p);
        });
        
        const prefixNodes = Object.entries(byPrefix)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([prefix, prefixParts]) => 
            n(`cust-${custName.toLowerCase()}-${prefix}`, prefix, `${prefixParts.length} 個品號`, PALETTE.customer, 3, [], prefixParts)
          );
        
        nodes.push(n(`cust-${custName.toLowerCase()}`, custName, `${custParts.length} 個品號`, PALETTE.customer, 2, prefixNodes, custParts));
      }
    });
    
    return nodes;
  };
  
  // 構建組件節點（按 SA/SB/SC/SD 分組）
  const buildAssemblyNodes = (): MindMapNode[] => {
    const nodes: MindMapNode[] = [];
    
    // SA 系列
    const saParts = groups.assembly.filter(p => p.partNo.startsWith('SA'));
    if (saParts.length > 0) {
      nodes.push(n('assemblies-sa', 'SA 系列', `${saParts.length} 個組件`, PALETTE.assembly, 2, buildPartNodes(saParts, 3), saParts, 'factory_asm_sa'));
    }
    
    // SB 系列
    const sbParts = groups.assembly.filter(p => p.partNo.startsWith('SB'));
    if (sbParts.length > 0) {
      nodes.push(n('assemblies-sb', 'SB 系列', `${sbParts.length} 個組件`, PALETTE.assembly, 2, buildPartNodes(sbParts, 3), sbParts, 'factory_asm_sb'));
    }
    
    // SC 系列
    const scParts = groups.assembly.filter(p => p.partNo.startsWith('SC'));
    if (scParts.length > 0) {
      nodes.push(n('assemblies-sc', 'SC 系列', `${scParts.length} 個組件`, PALETTE.assembly, 2, buildPartNodes(scParts, 3), scParts, 'factory_asm_sc'));
    }
    
    // SD 系列
    const sdParts = groups.assembly.filter(p => p.partNo.startsWith('SD'));
    if (sdParts.length > 0) {
      nodes.push(n('assemblies-sd', 'SD 系列', `${sdParts.length} 個組件`, PALETTE.assembly, 2, buildPartNodes(sdParts, 3), sdParts, 'factory_asm_sd'));
    }
    
    // 特殊組件（3M41459 等）
    const specialParts = groups.assembly.filter(p => !p.partNo.startsWith('SA') && !p.partNo.startsWith('SB') && !p.partNo.startsWith('SC') && !p.partNo.startsWith('SD'));
    if (specialParts.length > 0) {
      nodes.push(n('assemblies-special', '特殊組件', `${specialParts.length} 個`, PALETTE.assembly, 2, buildPartNodes(specialParts, 3), specialParts));
    }
    
    return nodes;
  };
  
  // 構建 Set 節點
  const buildSetNodes = (): MindMapNode[] => {
    const mdxeParts = groups.set.filter(p => p.partNo.startsWith('MDXE-'));
    const mdxiParts = groups.set.filter(p => p.partNo.startsWith('MDXI-'));
    
    const nodes: MindMapNode[] = [];
    
    if (mdxeParts.length > 0) {
      nodes.push(n('sets-mdxe', 'MDXE Extension Set', `${mdxeParts.length} 套`, PALETTE.set, 2, buildPartNodes(mdxeParts, 3), mdxeParts, 'factory_set_mdxe'));
    }
    
    if (mdxiParts.length > 0) {
      nodes.push(n('sets-mdxi', 'MDXI I.V. Set', `${mdxiParts.length} 套`, PALETTE.set, 2, buildPartNodes(mdxiParts, 3), mdxiParts, 'factory_set_mdxi'));
    }
    
    return nodes;
  };
  
  // 一般零件（無客戶標識）
  const generalParts = groups.part.filter(p => !getCustomerSubCategory(p));
  const customerParts = groups.part.filter(p => getCustomerSubCategory(p));
  
  // 構建主樹
  return n('root', '產品識別教育訓練', `共 ${parts.length} 個品號 · 點擊展開`, PALETTE.root, 0, [
    // 1. 原料（若有）
    ...(groups.raw.length > 0 ? [
      n('raw', '原料', `${groups.raw.length} 種`, PALETTE.raw, 1, buildPartNodes(groups.raw, 2), groups.raw)
    ] : []),
    
    // 2. 物料
    n('materials', '物料', `${groups.material.length} 種`, PALETTE.material, 1, buildPartNodes(groups.material, 2), groups.material, 'unclassified'),
    
    // 3. 零件（含客戶分類）
    ...(generalParts.length > 0 ? [
      n('parts-general', '廠內零件', `${generalParts.length} 個品號`, PALETTE.part, 1, buildPartNodes(generalParts, 2), generalParts)
    ] : []),
    
    ...(customerParts.length > 0 ? [
      n('parts-customers', '客戶零件', `${customerParts.length} 個品號`, PALETTE.customer, 1, buildCustomerNodes(), customerParts)
    ] : []),
    
    // 4. 組件
    ...(groups.assembly.length > 0 ? [
      n('assemblies', '組件', `${groups.assembly.length} 個`, PALETTE.assembly, 1, buildAssemblyNodes(), groups.assembly)
    ] : []),
    
    // 5. Set
    ...(groups.set.length > 0 ? [
      n('sets', 'Set 產品', `${groups.set.length} 套`, PALETTE.set, 1, buildSetNodes(), groups.set)
    ] : []),
    
    // 6. 待分類
    ...(unclassified.length > 0 ? [
      n('unclassified', '待分類', `${unclassified.length} 個品號`, PALETTE.unclassified, 1, [], unclassified)
    ] : []),
  ], []);
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
      p.name?.toLowerCase().includes(q) || 
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
  if (node.parts && node.parts.length > 0) return node.parts.length;
  return node.children.reduce((s, c) => s + countParts(c), 0);
}
