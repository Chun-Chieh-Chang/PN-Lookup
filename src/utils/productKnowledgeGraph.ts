import { PartItem } from '../types';
import { getItemType, getBOMChildren } from './bomEngine';

export interface GraphNode {
  id: string;
  name: string;
  group: 'category' | 'coding' | 'assembly' | 'part' | 'customer';
  val: number;
  color: string;
  description?: string;
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

// Morandi 專業調色盤
export const GROUP_COLORS: Record<GraphNode['group'], string> = {
  category: '#6366F1', // 靛藍 - 產品總類
  coding: '#8B5CF6',   // 紫色 - 編碼規則
  assembly: '#0EA5E9', // 天藍 - SA/SB/SC/SD 組立
  part: '#10B981',     // 翡翠綠 - 實體單品零件
  customer: '#F59E0B', // 琥珀黃 - 客戶對照料號
};

// 《產品識別教育訓練》與《編碼記憶》之系統化知識架構
const CODING_RULES = [
  {
    id: 'rule-sa',
    name: 'SA 系列 (呼吸迴路/管路組立)',
    group: 'coding' as const,
    val: 18,
    color: GROUP_COLORS.coding,
    description: '【編碼規則】SA 開頭為呼吸迴路、急救甦醒器與次組合管路。下含 SA-001 至 SA-132 等主力配件。',
  },
  {
    id: 'rule-sb',
    name: 'SB 系列 (醫用轉接頭/閥門組立)',
    group: 'coding' as const,
    val: 16,
    color: GROUP_COLORS.coding,
    description: '【編碼規則】SB 開頭為直通/三通轉接頭、吐氣閥、壓力監測閥等連接組件。',
  },
  {
    id: 'rule-sc',
    name: 'SC 系列 (面罩/鼻罩/呼吸組件)',
    group: 'coding' as const,
    val: 14,
    color: GROUP_COLORS.coding,
    description: '【編碼規則】SC 開頭為各式麻醉面罩、氧氣面罩與鼻罩配件組裝。',
  },
  {
    id: 'rule-sd',
    name: 'SD 系列 (濕化水瓶/集水杯組立)',
    group: 'coding' as const,
    val: 12,
    color: GROUP_COLORS.coding,
    description: '【編碼規則】SD 開頭為濕化瓶、集水杯、過濾器等液體防護與加熱配件。',
  },
  {
    id: 'rule-inj',
    name: '基礎單品射出配件 (Injection Components)',
    group: 'coding' as const,
    val: 15,
    color: GROUP_COLORS.coding,
    description: '【編碼規則】未歸類為 SA/SB/SC/SD 之基礎射出件、管材、矽膠閥片與橡膠配件。',
  },
];

export function buildProductKnowledgeGraph(parts: PartItem[]): GraphData {
  const nodesMap = new Map<string, GraphNode>();
  const linksMap = new Map<string, GraphLink>();

  const addLink = (source: string, target: string, label?: string, value = 1) => {
    if (!source || !target || source === target) return;
    const key = `${source}->${target}`;
    if (!linksMap.has(key)) {
      linksMap.set(key, { source, target, label, value });
    }
  };

  // 1. 加入總分類頂點 (Root Category Node)
  const rootNode: GraphNode = {
    id: 'root-product-knowledge',
    name: '凱益醫療產品知識總圖譜',
    group: 'category',
    val: 28,
    color: GROUP_COLORS.category,
    description: '全景醫療器材產品分類、編碼記憶規則與 BOM 階層結構點對點關係圖。',
  };
  nodesMap.set(rootNode.id, rootNode);

  // 2. 加入編碼記憶規則節點
  for (const rule of CODING_RULES) {
    nodesMap.set(rule.id, rule);
    addLink(rootNode.id, rule.id, '包含分類', 3);
  }

  // 取得全域 BOM 階層樹
  const bomChildren = getBOMChildren();

  // 3. 加入品號與 BOM 關係
  for (const item of parts) {
    const itemType = getItemType(item);
    const isAssembly = itemType === 'assembly';
    const isCust = item.category?.includes('客戶特規');
    
    let group: GraphNode['group'] = 'part';
    let targetRuleId = 'rule-inj';

    if (item.partNo.startsWith('SA-')) {
      group = 'assembly';
      targetRuleId = 'rule-sa';
    } else if (item.partNo.startsWith('SB-')) {
      group = 'assembly';
      targetRuleId = 'rule-sb';
    } else if (item.partNo.startsWith('SC-')) {
      group = 'assembly';
      targetRuleId = 'rule-sc';
    } else if (item.partNo.startsWith('SD-')) {
      group = 'assembly';
      targetRuleId = 'rule-sd';
    } else if (isCust) {
      group = 'customer';
    }

    const children = bomChildren[item.partNo] || [];

    const node: GraphNode = {
      id: item.partNo,
      name: `${item.partNo} (${item.customer || '通用'})`,
      group,
      val: isAssembly ? 14 : 8,
      color: GROUP_COLORS[group],
      description: `${item.name} | 客戶: ${item.customer || '通用'} | 分類: ${item.category || '未分類'}`,
      details: {
        partNo: item.partNo,
        customer: item.customer,
        category: item.category,
        material: item.material,
        colorName: item.color,
        componentsCount: children.length,
      },
    };

    nodesMap.set(node.id, node);
    addLink(targetRuleId, node.id, '歸屬類別', 2);

    // 掛載 BOM 結構邊
    for (const childPartNo of children) {
      addLink(node.id, childPartNo, 'BOM 組成', 1);
    }

    // 掛載別稱/替代品號節點
    if (item.alternates && item.alternates.length > 0) {
      for (const alt of item.alternates) {
        const altId = `alt-${alt}`;
        if (!nodesMap.has(altId)) {
          nodesMap.set(altId, {
            id: altId,
            name: `別名: ${alt}`,
            group: 'customer',
            val: 6,
            color: GROUP_COLORS.customer,
            description: `品號 ${item.partNo} 之客戶或供應商別稱品號`,
            details: {
              partNo: alt,
              customer: item.customer,
            },
          });
        }
        addLink(node.id, altId, '別名對照', 1);
      }
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    links: Array.from(linksMap.values()),
  };
}
