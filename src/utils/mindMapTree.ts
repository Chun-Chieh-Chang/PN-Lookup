import { PartItem } from '../types';
import { MindMapCategory } from './mindmapClassifier';

// ────────────────────────────────────────────────────────────────────────────
// 產品思維導圖樹結構（新結構：原料→物料→零件→組件→Set）
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
  material:    { bg: '#f1f5f9', border: '#64748b', text: '#334155' },   // Slate - 物料
  part:        { bg: '#f0fdf4', border: '#16a34a', text: '#14532d' },   // Emerald - 零件
  assembly:    { bg: '#eff6ff', border: '#3b82f6', text: '#1e3a8a' },   // Blue - 組件
  set:         { bg: '#faf5ff', border: '#9333ea', text: '#3b0764' },   // Purple - Set
  customer:    { bg: '#fff7ed', border: '#f97316', text: '#7c2d12' },   // Orange - 客戶
  unclassified:{ bg: '#f8fafc', border: '#cbd5e1', text: '#64748b' },   // Gray
};

// ────────────────────────────────────────────────────────────────────────────
// 從 Master Table 建構思維導圖（新結構）
// ────────────────────────────────────────────────────────────────────────────



type MaterialGroup = 'raw' | 'material' | 'part' | 'assembly' | 'set';

// 判斷品號的材質/類型分組
function getMaterialGroup(part: PartItem): MaterialGroup {
  const cat = part.category || '';
  
  // 物料類別
  if (cat === '物料') return 'material';
  
  // Set 類別（MDXE/MDXI）
  if (part.partNo.startsWith('MDXE-') || part.partNo.startsWith('MDXI-')) {
    return 'set';
  }
  
  // 組件類別（SA/SB/SC/SD + 其他組立）
  if (cat.includes('組立') || part.partNo.startsWith('SA') || 
      part.partNo.startsWith('SB') || part.partNo.startsWith('SC') || 
      part.partNo.startsWith('SD')) {
    return 'assembly';
  }
  
  // 特殊組件（3M41459 等）
  if (part.partNo === '3M41459') return 'assembly';
  
  // ICU 插袋針/採藥針（客戶零件）
  if (part.partNo.startsWith('R1-') || part.partNo.startsWith('27-') || 
      part.partNo.startsWith('75-') || part.partNo.startsWith('CIV') || 
      part.partNo.startsWith('RAW')) {
    return 'part'; // ICU 零件仍屬零件層級
  }
  
  // 一般廠內零件
  return 'part';
}

// 獲取客戶類別（用於在零件節點下創建客戶子分組）
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
  
  // 客戶分組（嵌套在零件中）
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
  
  // 構建客戶子分組節點
  const buildCustomerNode = (
    customerId: string,
    label: string,
    sublabel: string,
    customerParts: PartItem[]
  ): MindMapNode => {
    // 進一步按零件前綴分類
    const partByPrefix: Record<string, PartItem[]> = {};
    customerParts.forEach(p => {
      const prefix = p.partNo.split('-')[0];
      if (!partByPrefix[prefix]) partByPrefix[prefix] = [];
      partByPrefix[prefix].push(p);
    });
    
    const prefixNodes = Object.entries(partByPrefix)
      .filter(([, p]) => p.length > 0)
      .map(([prefix, prefixParts]) => 
        n(`cust-${customerId}-${prefix}`, prefix, `${prefixParts.length} 個品號`, PALETTE.part, 3, [], prefixParts)
      );
    
    return n(`cust-${customerId}`, label, sublabel, PALETTE.customer, 2, prefixNodes, customerParts, 'customer_bd');
  };
  
  // 構建零件分組（含客戶子分組）
  const buildPartsWithCustomers = (): MindMapNode[] => {
    const nodes: MindMapNode[] = [];
    
    // 一般廠內零件（無客戶標識）
    const generalParts = groups.part.filter(p => !getCustomerSubCategory(p));
    if (generalParts.length > 0) {
      // 按前綴分組顯示
      const byPrefix: Record<string, PartItem[]> = {};
      generalParts.forEach(p => {
        const prefix = p.partNo.split('-')[0];
        if (!byPrefix[prefix]) byPrefix[prefix] = [];
        byPrefix[prefix].push(p);
      });
      
      const prefixNodes = Object.entries(byPrefix)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(0, 15) // 限制顯示數量
        .map(([prefix, prefixParts]) => 
          n(`part-${prefix}`, prefix, `${prefixParts.length} 個品號`, PALETTE.part, 2, [], prefixParts)
        );
      
      nodes.push(n('parts-general', '廠內零件', `${generalParts.length} 個品號`, PALETTE.part, 1, prefixNodes, generalParts));
    }
    
    // 客戶零件
    Object.entries(customerGroups).forEach(([custName, custParts]) => {
      if (custParts.length > 0) {
        nodes.push(buildCustomerNode(custName.toLowerCase(), custName, `${custParts.length} 個品號`, custParts));
      }
    });
    
    return nodes;
  };
  
  // 構建組件節點（包含 BOM 關係）
  const buildAssemblyNode = (
    assemblyId: string,
    label: string,
    sublabel: string,
    assemblyParts: PartItem[],
    depth: number = 2
  ): MindMapNode => {
    // 假設我們有 bomChildren 數據，這裡簡化處理
    // 實際應從 master.bom.children 讀取
    return n(`asm-${assemblyId}`, label, sublabel, PALETTE.assembly, depth, [], assemblyParts, 'factory_asm_sa');
  };
  
  // 構建主樹
  const partWithCustomerNodes = buildPartsWithCustomers();
  
  return n('root', '產品識別教育訓練', `共 ${parts.length} 個品號 · 點擊展開`, PALETTE.root, 0, [
    // 1. 原料（若有）
    ...(groups.raw.length > 0 ? [
      n('raw', '原料', `${groups.raw.length} 種`, PALETTE.material, 1, [], groups.raw)
    ] : []),
    
    // 2. 物料
    n('materials', '物料', `${groups.material.length} 種`, PALETTE.material, 1, [], groups.material, 'unclassified'),
    
    // 3. 零件（含客戶分類）
    ...partWithCustomerNodes,
    
    // 4. 組件
    ...(groups.assembly.length > 0 ? [
      n('assemblies', '組件', `${groups.assembly.length} 個`, PALETTE.assembly, 1, [
        // SA 系列
        ...groups.assembly.filter(p => p.partNo.startsWith('SA')).slice(0, 5).map(p => 
          buildAssemblyNode(p.partNo, p.partNo, p.name || '', [p])
        ),
        // SB 系列
        ...groups.assembly.filter(p => p.partNo.startsWith('SB')).slice(0, 5).map(p => 
          buildAssemblyNode(p.partNo, p.partNo, p.name || '', [p])
        ),
      ], groups.assembly.slice(0, 10), 'factory_asm_sa'),
    ] : []),
    
    // 5. Set
    ...(groups.set.length > 0 ? [
      n('sets', 'Set 產品', `${groups.set.length} 套`, PALETTE.set, 1, [], groups.set, 'factory_set_mdxe'),
    ] : []),
    
    // 6. 待分類
    ...(unclassified.length > 0 ? [
      n('unclassified', '待分類', `${unclassified.length} 個品號`, PALETTE.unclassified, 1, [], unclassified),
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
  if (node.parts && node.parts.length > 0) return node.parts.length;
  return node.children.reduce((s, c) => s + countParts(c), 0);
}
