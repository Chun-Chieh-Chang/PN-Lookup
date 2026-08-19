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
// 從 Master Table 建構思維導圖（MECE 原則：不重覆、不漏失）
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
  
  // 分離一般零件和客戶零件
  const generalParts = groups.part.filter(p => !getCustomerSubCategory(p));
  const customerParts = groups.part.filter(p => getCustomerSubCategory(p));
  
  // 組件按 SA/SB/SC/SD 分類
  const saParts = groups.assembly.filter(p => p.partNo.startsWith('SA'));
  const sbParts = groups.assembly.filter(p => p.partNo.startsWith('SB'));
  const scParts = groups.assembly.filter(p => p.partNo.startsWith('SC'));
  const sdParts = groups.assembly.filter(p => p.partNo.startsWith('SD'));
  const specialParts = groups.assembly.filter(p => 
    !p.partNo.startsWith('SA') && !p.partNo.startsWith('SB') && 
    !p.partNo.startsWith('SC') && !p.partNo.startsWith('SD')
  );
  
  // Set 按 MDXE/MDXI 分類
  const mdxeParts = groups.set.filter(p => p.partNo.startsWith('MDXE-'));
  const mdxiParts = groups.set.filter(p => p.partNo.startsWith('MDXI-'));
  
  // 構建客戶子節點
  const buildCustomerNodes = (): MindMapNode[] => {
    const nodes: MindMapNode[] = [];
    Object.entries(customerGroups).forEach(([custName, custParts]) => {
      if (custParts.length > 0) {
        // 客戶零件下顯示具體品號（前綴分組）
        const byPrefix: Record<string, PartItem[]> = {};
        custParts.forEach(p => {
          const prefix = p.partNo.split('-')[0];
          if (!byPrefix[prefix]) byPrefix[prefix] = [];
          byPrefix[prefix].push(p);
        });
        
        const prefixNodes = Object.entries(byPrefix)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(0, 10) // 限制數量
          .map(([prefix, prefixParts]) => 
            n(`cust-${custName.toLowerCase()}-${prefix}`, prefix, `${prefixParts.length} 個品號`, PALETTE.customer, 3, [], prefixParts)
          );
        
        nodes.push(n(`cust-${custName.toLowerCase()}`, custName, `${custParts.length} 個品號`, PALETTE.customer, 2, prefixNodes, custParts));
      }
    });
    return nodes;
  };
  
  // 構建組件子節點（MECE: SA/SB/SC/SD + 特殊）
  // 每個分類節點包含其實際的子零件（來自 BOM children）
  const buildAssemblyNodes = (bomChildren: Record<string, string[]> = {}): MindMapNode[] => {
    const nodes: MindMapNode[] = [];
    
    // 輔助函數：構建單一組件的子節點（展開 BOM children）
    const buildAssemblyDetail = (assemblyId: string, label: string, parts: PartItem[]): MindMapNode => {
      const children = bomChildren[assemblyId] || [];
      const childNodes = children.map(childId => {
        const childPart = parts.find(p => p.partNo === childId);
        if (!childPart) return null;
        // 遞迴檢查是否還有子節點
        const grandChildren = bomChildren[childId] || [];
        if (grandChildren.length > 0) {
          // 有子節點，遞迴構建
          return buildAssemblyDetail(childId, childPart.name || childId, [childPart]);
        } else {
          // 葉節點
          return n(childId, childPart.name || childId, `${childPart.customer || ''}`, PALETTE.part, 3, [], [childPart]);
        }
      }).filter(Boolean);
      
      return n(assemblyId, label, `${parts.length} 個品號`, PALETTE.assembly, 2, childNodes, parts);
    };
    
    if (saParts.length > 0) {
      // SA 系列：顯示為一個節點，包含所有 SA 品號
      // 如果需要展開 BOM，傳遞 bomChildren
      nodes.push(n('asm-sa', 'SA 系列', `${saParts.length} 個組件`, PALETTE.assembly, 2, 
        saParts.map(p => buildAssemblyDetail(p.partNo, p.partNo, [p])), 
        saParts, 'factory_asm_sa'
      ));
    }
    if (sbParts.length > 0) {
      nodes.push(n('asm-sb', 'SB 系列', `${sbParts.length} 個組件`, PALETTE.assembly, 2,
        sbParts.map(p => buildAssemblyDetail(p.partNo, p.partNo, [p])),
        sbParts, 'factory_asm_sb'
      ));
    }
    if (scParts.length > 0) {
      nodes.push(n('asm-sc', 'SC 系列', `${scParts.length} 個組件`, PALETTE.assembly, 2,
        scParts.map(p => buildAssemblyDetail(p.partNo, p.partNo, [p])),
        scParts, 'factory_asm_sc'
      ));
    }
    if (sdParts.length > 0) {
      nodes.push(n('asm-sd', 'SD 系列', `${sdParts.length} 個組件`, PALETTE.assembly, 2,
        sdParts.map(p => buildAssemblyDetail(p.partNo, p.partNo, [p])),
        sdParts, 'factory_asm_sd'
      ));
    }
    if (specialParts.length > 0) {
      nodes.push(n('asm-special', '特殊組件', `${specialParts.length} 個`, PALETTE.assembly, 2,
        specialParts.map(p => buildAssemblyDetail(p.partNo, p.partNo, [p])),
        specialParts
      ));
    }
    
    return nodes;
  };
  
  // 構建 Set 子節點
  const buildSetNodes = (): MindMapNode[] => {
    const nodes: MindMapNode[] = [];
    if (mdxeParts.length > 0) {
      nodes.push(n('set-mdxe', 'MDXE Extension Set', `${mdxeParts.length} 套`, PALETTE.set, 2, [], mdxeParts, 'factory_set_mdxe'));
    }
    if (mdxiParts.length > 0) {
      nodes.push(n('set-mdxi', 'MDXI I.V. Set', `${mdxiParts.length} 套`, PALETTE.set, 2, [], mdxiParts, 'factory_set_mdxi'));
    }
    return nodes;
  };
  
  // 構建主樹
  return n('root', '產品識別教育訓練', `共 ${parts.length} 個品號 · 點擊展開`, PALETTE.root, 0, [
    // 1. 原料（若有）
    ...(groups.raw.length > 0 ? [
      n('raw', '原料', `${groups.raw.length} 種`, PALETTE.raw, 1, [], groups.raw)
    ] : []),
    
    // 2. 物料
    n('materials', '物料', `${groups.material.length} 種`, PALETTE.material, 1, [], groups.material, 'unclassified'),
    
    // 3. 零件（含客戶分類）
    ...(generalParts.length > 0 ? [
      n('parts-general', '廠內零件', `${generalParts.length} 個品號`, PALETTE.part, 1, [], generalParts)
    ] : []),
    
    ...(customerParts.length > 0 ? [
      n('parts-customers', '客戶零件', `${customerParts.length} 個品號`, PALETTE.customer, 1, buildCustomerNodes(), customerParts)
    ] : []),
    
    // 4. 組件（MECE: SA/SB/SC/SD + 特殊）
    ...(groups.assembly.length > 0 ? [
      n('assemblies', '組件', `${groups.assembly.length} 個組件`, PALETTE.assembly, 1, buildAssemblyNodes(), groups.assembly)
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
