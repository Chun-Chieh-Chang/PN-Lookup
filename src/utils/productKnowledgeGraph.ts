import { PartItem } from '../types';
import { getItemType, getBOMChildren } from './bomEngine';

export type NodeGroup =
  | 'category_root'
  | 'factory_set'        // Set 系統組合
  | 'factory_assembly'   // 組件分類 (SA/SB/SC/SD)
  | 'factory_part'       // 零件分類 (射出/矽膠/金屬)
  | 'factory_material'   // 原料屬性 (PVC/Silicone/PC/PP)
  | 'factory_spec'       // 尺寸特性 (ID/OD/15M/22M)
  | 'factory_color'      // 顏色屬性 (Blue/Clear/Green)
  | 'customer_icu'       // ICU 重症客戶體系
  | 'customer_oem';      // OEM/ODM 客戶體系

export interface GraphNode {
  id: string;
  name: string;
  group: NodeGroup;
  val: number;
  color: string;
  description?: string;
  axis: 'factory' | 'customer' | 'material' | 'spec' | 'color' | 'both';
  details?: {
    partNo?: string;
    customer?: string;
    category?: string;
    material?: string;
    colorName?: string;
    componentsCount?: number;
    assembliesCount?: number;
  };
  x?: number;
  y?: number;
  z?: number;
  x3d?: number;
  y3d?: number;
  z3d?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  label?: string;
  value?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export type AxisFilterMode = 'all' | 'factory' | 'customer' | 'material' | 'spec' | 'color';

// Taste-Skill Morandi 多維度專屬調色盤
export const GROUP_COLORS: Record<NodeGroup, string> = {
  category_root: '#6366F1',   // 靛藍 - 總架構
  factory_set: '#8B5CF6',      // 炫紫 - Set 系統組合
  factory_assembly: '#0EA5E9', // 天藍 - SA/SB/SC/SD 組立
  factory_part: '#10B981',     // 翡翠綠 - 單品零件
  factory_material: '#EC4899', // 粉紫 - 原料分類 (PVC/Silicone/PC)
  factory_spec: '#14B8A6',     // 青綠 - 尺寸特性 (15M/22M/ID/OD)
  factory_color: '#F43F5E',    // 玫瑰紅 - 顏色區分 (Clear/Blue/Green)
  customer_icu: '#F59E0B',     // 琥珀金 - ICU 專業客戶
  customer_oem: '#EAB308',     // 鵝黃 - OEM/ODM 客戶
};

// 1. 廠內 MindMap 與《編碼記憶》核心架構節點
const FACTORY_MINDMAP_NODES = [
  {
    id: 'mindmap-set',
    name: 'Set 系統組合套件 (Breathing Set Kits)',
    group: 'factory_set' as const,
    val: 20,
    color: GROUP_COLORS.factory_set,
    axis: 'factory' as const,
    description: '【廠內 MindMap - Set】包含完整的呼吸迴路包、麻醉管組與加溫加濕套件組裝。',
  },
  {
    id: 'mindmap-sa',
    name: 'SA 系列 (呼吸迴路/次組合管路)',
    group: 'factory_assembly' as const,
    val: 18,
    color: GROUP_COLORS.factory_assembly,
    axis: 'factory' as const,
    description: '【編碼記憶 - SA】SA 開頭為呼吸管路、蛇木管、雙平滑管與蛇管配件次組合。',
  },
  {
    id: 'mindmap-sb',
    name: 'SB 系列 (醫用轉接頭/閥門組裝)',
    group: 'factory_assembly' as const,
    val: 17,
    color: GROUP_COLORS.factory_assembly,
    axis: 'factory' as const,
    description: '【編碼記憶 - SB】SB 開頭為直通/三通轉接頭、吐氣閥、PEEP 閥與壓力監測介面。',
  },
  {
    id: 'mindmap-sc',
    name: 'SC 系列 (面罩/鼻罩/呼吸組件)',
    group: 'factory_assembly' as const,
    val: 16,
    color: GROUP_COLORS.factory_assembly,
    axis: 'factory' as const,
    description: '【編碼記憶 - SC】SC 開頭為氣墊面罩、無氣墊面罩、鼻罩與固定頭帶組裝。',
  },
  {
    id: 'mindmap-sd',
    name: 'SD 系列 (濕化水瓶/集水杯組裝)',
    group: 'factory_assembly' as const,
    val: 15,
    color: GROUP_COLORS.factory_assembly,
    axis: 'factory' as const,
    description: '【編碼記憶 - SD】SD 開頭為加熱水瓶、自動給水水瓶與集水杯模組。',
  },
  {
    id: 'code-k-connectors',
    name: 'K 系列分流轉接頭 (K07/K08/K27)',
    group: 'factory_spec' as const,
    val: 16,
    color: GROUP_COLORS.factory_spec,
    axis: 'factory' as const,
    description: '【編碼記憶 - K系列】包含 K07 (Bi-Connector 雙通道)、K08 (Tri-Connector 三通道)、K27 (Quadfuse 四分分流頭)。',
  },
  {
    id: 'code-q-barbed',
    name: 'Q 系列倒鉤轉接件 (Q09/Q10 Barbed)',
    group: 'factory_spec' as const,
    val: 16,
    color: GROUP_COLORS.factory_spec,
    axis: 'factory' as const,
    description: '【編碼記憶 - Q系列】包含 Q09 (Barbed Connector with MLL 公 Luer 倒鉤接頭)、Q10 (Barbed Connector with FLL 母 Luer 倒鉤接頭)。',
  },
];

// 2. 客戶採購體系架構節點
const CUSTOMER_SYSTEM_NODES = [
  {
    id: 'cust-icu-system',
    name: 'ICU 重症醫用客戶體系 (ICU Specialty)',
    group: 'customer_icu' as const,
    val: 18,
    color: GROUP_COLORS.customer_icu,
    axis: 'customer' as const,
    description: '【客戶體系 - ICU】針對 ICU 呼吸重症醫學中心之專用編碼與對照料號。',
  },
  {
    id: 'cust-oem-system',
    name: 'OEM / ODM 合作客戶體系 (OEM/ODM Partners)',
    group: 'customer_oem' as const,
    val: 17,
    color: GROUP_COLORS.customer_oem,
    axis: 'customer' as const,
    description: '【客戶體系 - OEM/ODM】海內外醫療品牌代工與特規客戶圖檔對照號。',
  },
];

// 3. 多維度視角專屬核心節點 (原料/尺寸/顏色)
const MATERIAL_NODES = [
  { id: 'mat-pvc', name: 'PVC 聚氯乙烯 (PVC Grade)', group: 'factory_material' as const, val: 18, color: GROUP_COLORS.factory_material, axis: 'material' as const, description: '【原料多維】醫用級 PVC 軟管與軟質配件射出原料。' },
  { id: 'mat-silicone', name: 'Silicone 矽膠 (Silicone Elastomer)', group: 'factory_material' as const, val: 18, color: GROUP_COLORS.factory_material, axis: 'material' as const, description: '【原料多維】高彈性液態/固態矽膠閥片、氣墊面罩襯墊。' },
  { id: 'mat-pc', name: 'PC 聚碳酸酯 (Polycarbonate)', group: 'factory_material' as const, val: 17, color: GROUP_COLORS.factory_material, axis: 'material' as const, description: '【原料多維】高透明耐熱 PC 接頭、壓力測孔與硬質殼體。' },
  { id: 'mat-pp', name: 'PP 聚丙烯 (Polypropylene)', group: 'factory_material' as const, val: 16, color: GROUP_COLORS.factory_material, axis: 'material' as const, description: '【原料多維】PP 耐溫濕化水瓶蓋與轉接頭配件。' },
];

const SPEC_NODES = [
  { id: 'spec-15m', name: '15mm 國際標準口徑 (15M Standard)', group: 'factory_spec' as const, val: 17, color: GROUP_COLORS.factory_spec, axis: 'spec' as const, description: '【規格多維】15mm 醫用呼吸接口與小兒迴路對照。' },
  { id: 'spec-22m', name: '22mm 成人標準口徑 (22M Standard)', group: 'factory_spec' as const, val: 17, color: GROUP_COLORS.factory_spec, axis: 'spec' as const, description: '【規格多維】22mm 成人呼吸管路、蛇管與濕化水瓶介面。' },
  { id: 'spec-idod', name: 'ID / OD 外徑長度規格 (Tubes & Fittings)', group: 'factory_spec' as const, val: 16, color: GROUP_COLORS.factory_spec, axis: 'spec' as const, description: '【規格多維】各式內徑 (ID) 與外徑 (OD) 平滑管/蛇木管長度規格。' },
];

const COLOR_NODES = [
  { id: 'col-clear', name: 'Transparent 透明原色 (Clear Glass)', group: 'factory_color' as const, val: 17, color: GROUP_COLORS.factory_color, axis: 'color' as const, description: '【配色多維】高透光醫用無色透明配件。' },
  { id: 'col-blue', name: 'Medical Blue 醫療藍 (Blue Tint)', group: 'factory_color' as const, val: 17, color: GROUP_COLORS.factory_color, axis: 'color' as const, description: '【配色多維】藍色呼吸迴路管與旋鈕識別配色。' },
  { id: 'col-green', name: 'Oxygen Green 氧氣綠 (Green Tint)', group: 'factory_color' as const, val: 16, color: GROUP_COLORS.factory_color, axis: 'color' as const, description: '【配色多維】綠色氧氣導管與急救套件配色。' },
];

export function buildProductKnowledgeGraph(
  parts: PartItem[],
  axisFilter: AxisFilterMode = 'all'
): GraphData {
  const nodesMap = new Map<string, GraphNode>();
  const linksMap = new Map<string, GraphLink>();

  const addLink = (source: string, target: string, label?: string, value = 1) => {
    if (!source || !target || source === target) return;
    const key = `${source}->${target}`;
    if (!linksMap.has(key)) {
      linksMap.set(key, { source, target, label, value });
    }
  };

  // 核心 Root
  const rootNode: GraphNode = {
    id: 'root-hexa',
    name: '🌐 六大多維度醫療知識全景總綱 (Hexa-Matrix)',
    group: 'category_root',
    val: 28,
    color: GROUP_COLORS.category_root,
    axis: 'both',
    description: '整合【廠內 MindMap】、【編碼記憶】、【客戶體系】、【原料】、【規格】與【配色】之六維矩陣。',
  };
  nodesMap.set(rootNode.id, rootNode);

  // 依據 axisFilter 載入多維核心節點
  if (axisFilter === 'all' || axisFilter === 'factory') {
    for (const node of FACTORY_MINDMAP_NODES) {
      nodesMap.set(node.id, node);
      addLink(rootNode.id, node.id, '廠內結構', 3);
    }
  }

  if (axisFilter === 'all' || axisFilter === 'customer') {
    for (const node of CUSTOMER_SYSTEM_NODES) {
      nodesMap.set(node.id, node);
      addLink(rootNode.id, node.id, '客戶體系', 3);
    }
  }

  if (axisFilter === 'all' || axisFilter === 'material') {
    for (const node of MATERIAL_NODES) {
      nodesMap.set(node.id, node);
      addLink(rootNode.id, node.id, '原料矩陣', 3);
    }
  }

  if (axisFilter === 'all' || axisFilter === 'spec') {
    for (const node of SPEC_NODES) {
      nodesMap.set(node.id, node);
      addLink(rootNode.id, node.id, '規格矩陣', 3);
    }
  }

  if (axisFilter === 'all' || axisFilter === 'color') {
    for (const node of COLOR_NODES) {
      nodesMap.set(node.id, node);
      addLink(rootNode.id, node.id, '配色識別', 3);
    }
  }

  const bomChildren = getBOMChildren();

  // 掛載實體品號與多維對應
  for (const item of parts) {
    const itemType = getItemType(item);
    const isAssembly = itemType === 'assembly';
    const isICU = item.customer?.toUpperCase().includes('ICU') || item.partNo.includes('ICU');

    let group: NodeGroup = 'factory_part';
    let targetMindMapId = 'mindmap-sa';
    let targetCustId = isICU ? 'cust-icu-system' : 'cust-oem-system';

    if (item.partNo.startsWith('SA-')) {
      group = 'factory_assembly';
      targetMindMapId = 'mindmap-sa';
    } else if (item.partNo.startsWith('SB-')) {
      group = 'factory_assembly';
      targetMindMapId = 'mindmap-sb';
    } else if (item.partNo.startsWith('SC-')) {
      group = 'factory_assembly';
      targetMindMapId = 'mindmap-sc';
    } else if (item.partNo.startsWith('SD-')) {
      group = 'factory_assembly';
      targetMindMapId = 'mindmap-sd';
    } else if (item.category?.includes('Set') || item.category?.includes('套件')) {
      group = 'factory_set';
      targetMindMapId = 'mindmap-set';
    }

    const children = bomChildren[item.partNo] || [];

    const node: GraphNode = {
      id: item.partNo,
      name: `${item.partNo} (${item.customer || '通用'})`,
      group,
      val: isAssembly ? 13 : 8,
      color: GROUP_COLORS[group],
      axis: 'both',
      description: `${item.name} | 客戶: ${item.customer || '通用'} | 原料: ${item.material || '標準'} | 顏色: ${item.color || '自然色'}`,
      details: {
        partNo: item.partNo,
        customer: item.customer,
        category: item.category,
        material: item.material,
        colorName: item.color,
        componentsCount: children.length,
      },
    };

    const shouldIncludeNode =
      axisFilter === 'all' ||
      (axisFilter === 'factory' && (group === 'factory_assembly' || group === 'factory_set' || group === 'factory_part')) ||
      (axisFilter === 'customer' && (item.customer || item.alternates?.length)) ||
      (axisFilter === 'material' && item.material) ||
      (axisFilter === 'spec' && (item.partNo.includes('15') || item.partNo.includes('22') || item.name.includes('mm'))) ||
      (axisFilter === 'color' && item.color);

    if (shouldIncludeNode) {
      if (!nodesMap.has(node.id)) nodesMap.set(node.id, node);

      // 1. 廠內 MindMap 連結
      if (axisFilter === 'all' || axisFilter === 'factory') {
        addLink(targetMindMapId, node.id, '歸屬 MindMap', 2);
        if (item.partNo.includes('K07') || item.partNo.includes('K08') || item.partNo.includes('K27')) {
          addLink('code-k-connectors', node.id, 'K系列分流對照', 2);
        }
        if (item.partNo.includes('Q09') || item.partNo.includes('Q10')) {
          addLink('code-q-barbed', node.id, 'Q系列倒鉤對照', 2);
        }
      }

      // 2. 客戶體系連結
      if (axisFilter === 'all' || axisFilter === 'customer') {
        addLink(targetCustId, node.id, '採購對照', 2);
      }

      // 3. 原料多維連結
      if (axisFilter === 'all' || axisFilter === 'material') {
        const matUpper = (item.material || '').toUpperCase();
        if (matUpper.includes('PVC')) addLink('mat-pvc', node.id, 'PVC 原料', 2);
        if (matUpper.includes('SILICONE') || matUpper.includes('矽膠')) addLink('mat-silicone', node.id, 'Silicone 原料', 2);
        if (matUpper.includes('PC') || matUpper.includes('POLYCARBONATE')) addLink('mat-pc', node.id, 'PC 原料', 2);
        if (matUpper.includes('PP')) addLink('mat-pp', node.id, 'PP 原料', 2);
      }

      // 4. 規格多維連結
      if (axisFilter === 'all' || axisFilter === 'spec') {
        const nameUpper = (item.name || '').toUpperCase();
        if (item.partNo.includes('15') || nameUpper.includes('15M') || nameUpper.includes('15MM')) addLink('spec-15m', node.id, '15mm 規格', 2);
        if (item.partNo.includes('22') || nameUpper.includes('22M') || nameUpper.includes('22MM')) addLink('spec-22m', node.id, '22mm 規格', 2);
        if (nameUpper.includes('OD') || nameUpper.includes('ID') || nameUpper.includes('管')) addLink('spec-idod', node.id, '管徑規格', 2);
      }

      // 5. 配色多維連結
      if (axisFilter === 'all' || axisFilter === 'color') {
        const colUpper = (item.color || '').toUpperCase();
        if (colUpper.includes('BLUE') || colUpper.includes('藍')) addLink('col-blue', node.id, '醫療藍配色', 2);
        if (colUpper.includes('GREEN') || colUpper.includes('綠')) addLink('col-green', node.id, '氧氣綠配色', 2);
        if (colUpper.includes('CLEAR') || colUpper.includes('透明')) addLink('col-clear', node.id, '透明原色', 2);
      }

      // BOM 組成邊
      for (const childPartNo of children) {
        if (nodesMap.has(node.id)) {
          addLink(node.id, childPartNo, 'BOM 組成', 1);
        }
      }
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    links: Array.from(linksMap.values()),
  };
}
