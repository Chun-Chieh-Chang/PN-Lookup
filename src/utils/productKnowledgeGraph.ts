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
  axis: 'factory' | 'customer' | 'both';
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

// Taste-Skill Morandi 雙軸心調色盤
export const GROUP_COLORS: Record<NodeGroup, string> = {
  category_root: '#6366F1',   // 靛藍 - 總架構
  factory_set: '#8B5CF6',      // 炫紫 - Set 系統組合
  factory_assembly: '#0EA5E9', // 天藍 - SA/SB/SC/SD 組立
  factory_part: '#10B981',     // 翡翠綠 - 單品零件
  factory_material: '#EC4899', // 粉紫 - 原料分類
  factory_spec: '#14B8A6',     // 青綠 - 尺寸特性
  factory_color: '#F43F5E',    // 玫瑰紅 - 顏色區分
  customer_icu: '#F59E0B',     // 琥珀金 - ICU 專業客戶
  customer_oem: '#EAB308',     // 鵝黃 - OEM/ODM 客戶
};

// 廠內 MindMap 與《編碼記憶》核心架構節點
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
  // 《編碼記憶.pdf》關鍵分流與倒鉤編碼法則
  {
    id: 'code-k-connectors',
    name: 'K 系列分流轉接頭 (K07/K08/K27 Connectors)',
    group: 'factory_spec' as const,
    val: 16,
    color: GROUP_COLORS.factory_spec,
    axis: 'factory' as const,
    description: '【編碼記憶 - K系列】包含 K07 (Bi-Connector 雙通道)、K08 (Tri-Connector 三通道)、K27 (Quadfuse 四分分流頭)。',
  },
  {
    id: 'code-q-barbed',
    name: 'Q 系列倒鉤轉接件 (Q09/Q10 Barbed Fittings)',
    group: 'factory_spec' as const,
    val: 16,
    color: GROUP_COLORS.factory_spec,
    axis: 'factory' as const,
    description: '【編碼記憶 - Q系列】包含 Q09 (Barbed Connector with MLL 公 Luer 倒鉤接頭)、Q10 (Barbed Connector with FLL 母 Luer 倒鉤接頭)。',
  },
  {
    id: 'mindmap-material',
    name: '廠內原料屬性分類 (Material Matrix)',
    group: 'factory_material' as const,
    val: 16,
    color: GROUP_COLORS.factory_material,
    axis: 'factory' as const,
    description: '【廠內 MindMap - 原料】PVC 軟硬管材、Silicone 矽膠閥片、PC 耐熱聚碳酸酯、PP 聚丙烯。',
  },
  {
    id: 'mindmap-spec',
    name: '尺寸規格屬性分類 (Dimension Specs)',
    group: 'factory_spec' as const,
    val: 14,
    color: GROUP_COLORS.factory_spec,
    axis: 'factory' as const,
    description: '【廠內 MindMap - 尺寸】國際標準 15mm/22mm 接頭、外徑 ID/OD 與長度規格。',
  },
];

// 客戶採購體系架構節點
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

export function buildProductKnowledgeGraph(
  parts: PartItem[],
  axisFilter: 'all' | 'factory' | 'customer' = 'all'
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

  // 1. 廠內軸心 Root
  const factoryRoot: GraphNode = {
    id: 'root-factory',
    name: '🏭 廠內權威分類體系 (Factory MindMap)',
    group: 'category_root',
    val: 26,
    color: GROUP_COLORS.category_root,
    axis: 'factory',
    description: '依據廠內 MindMap 心智圖與品號分類代碼建構之權威物料體系。',
  };

  // 2. 客戶軸心 Root
  const customerRoot: GraphNode = {
    id: 'root-customer',
    name: '🏢 客戶採購與對照體系 (Customer Networks)',
    group: 'category_root',
    val: 24,
    color: GROUP_COLORS.category_root,
    axis: 'customer',
    description: '依據 ICU 重症編碼與 OEM/ODM 客戶需求劃分之採購與料號對照體系。',
  };

  if (axisFilter === 'all' || axisFilter === 'factory') {
    nodesMap.set(factoryRoot.id, factoryRoot);
    for (const node of FACTORY_MINDMAP_NODES) {
      nodesMap.set(node.id, node);
      addLink(factoryRoot.id, node.id, '廠內結構', 3);
    }
  }

  if (axisFilter === 'all' || axisFilter === 'customer') {
    nodesMap.set(customerRoot.id, customerRoot);
    for (const node of CUSTOMER_SYSTEM_NODES) {
      nodesMap.set(node.id, node);
      addLink(customerRoot.id, node.id, '客戶體系', 3);
    }
  }

  const bomChildren = getBOMChildren();

  // 3. 掛載實體品號與雙軸心連結
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
      description: `${item.name} | 客戶: ${item.customer || '通用'} | 原料: ${item.material || '標淮'} | 顏色: ${item.color || '自然色'}`,
      details: {
        partNo: item.partNo,
        customer: item.customer,
        category: item.category,
        material: item.material,
        colorName: item.color,
        componentsCount: children.length,
      },
    };

    if (axisFilter === 'all' || axisFilter === 'factory') {
      nodesMap.set(node.id, node);
      addLink(targetMindMapId, node.id, '歸屬 MindMap', 2);

      // 《編碼記憶.pdf》特定代碼關聯
      if (item.partNo.includes('K07') || item.partNo.includes('K08') || item.partNo.includes('K27')) {
        addLink('code-k-connectors', node.id, 'K系列分流對照', 2);
      }
      if (item.partNo.includes('Q09') || item.partNo.includes('Q10')) {
        addLink('code-q-barbed', node.id, 'Q系列倒鉤對照', 2);
      }
    }

    if (axisFilter === 'all' || axisFilter === 'customer') {
      if (!nodesMap.has(node.id)) nodesMap.set(node.id, node);
      addLink(targetCustId, node.id, '採購對照', 2);
    }

    // BOM 組成關聯邊
    for (const childPartNo of children) {
      if (nodesMap.has(node.id)) {
        addLink(node.id, childPartNo, 'BOM 組成', 1);
      }
    }

    // 掛載別名節點
    if (item.alternates && item.alternates.length > 0) {
      for (const alt of item.alternates) {
        const altId = `alt-${alt}`;
        const altGroup: NodeGroup = isICU ? 'customer_icu' : 'customer_oem';
        if (!nodesMap.has(altId) && (axisFilter === 'all' || axisFilter === 'customer')) {
          nodesMap.set(altId, {
            id: altId,
            name: `別名: ${alt}`,
            group: altGroup,
            val: 6,
            color: GROUP_COLORS[altGroup],
            axis: 'customer',
            description: `品號 ${item.partNo} 之客戶/供應商別稱對照號`,
            details: {
              partNo: alt,
              customer: item.customer,
            },
          });
          addLink(node.id, altId, '別名對照', 1);
        }
      }
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    links: Array.from(linksMap.values()),
  };
}
