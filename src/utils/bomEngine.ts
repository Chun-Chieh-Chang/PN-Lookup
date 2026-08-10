import { PartItem, ItemType } from '../types';
import { loadBOM } from './bomService';

let childrenMap: Record<string, string[]> = {};
let parentsMap: Record<string, string[]> = {};
let assemblySet: Set<string> = new Set();

let initPromise: Promise<void> | null = null;

// 字首規則：以這些開頭的品號一律視為組件（不需在 BOM 階層登記）
const ASSEMBLY_PART_NO_PREFIXES = ['MDXE'];

function isAssemblyPartNo(partNo: string): boolean {
  const upper = partNo.toUpperCase();
  if (assemblySet.has(upper) || assemblySet.has(partNo)) return true;
  return ASSEMBLY_PART_NO_PREFIXES.some((p) => upper.startsWith(p));
}

export function initBOM(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = loadBOM().then((data) => {
    childrenMap = data.children;
    parentsMap = data.parents;
    assemblySet = new Set(Object.keys(data.children));
  }).catch(() => {
    // keep static fallback
  });
  return initPromise;
}

export function updateBOMData(children: Record<string, string[]>, parents: Record<string, string[]>) {
  childrenMap = children;
  parentsMap = parents;
  assemblySet = new Set(Object.keys(children));
}

export function enrichParts(parts: PartItem[]): PartItem[] {
  return parts.map((p) => {
    const isAssembly = isAssemblyPartNo(p.partNo);
    const children = childrenMap[p.partNo] || childrenMap[p.partNo.toUpperCase()];
    const parents = parentsMap[p.partNo] || parentsMap[p.partNo.toUpperCase()];
    return {
      ...p,
      // 唯一真源 = BOM 階層：衍生欄位一律即時推導，不信任任何儲存值
      itemType: isAssembly ? 'assembly' as const : 'part' as const,
      components: children ? [...children] : undefined,
      usedInAssemblies: parents ? [...parents] : undefined,
    };
  });
}

// 落檔/傳輸前移除衍生欄位，確保 master.json 與 localStorage 只存純主檔
export function stripDerivedFields(parts: PartItem[]): PartItem[] {
  return parts.map((p) => {
    const { itemType, components, usedInAssemblies, ...rest } = p;
    void itemType; void components; void usedInAssemblies;
    return rest as PartItem;
  });
}

export function computeParentsMap(children: Record<string, string[]>): Record<string, string[]> {
  const parents: Record<string, string[]> = {};
  for (const [parent, comps] of Object.entries(children)) {
    for (const child of comps) {
      if (!parents[child]) parents[child] = [];
      if (!parents[child].includes(parent)) parents[child].push(parent);
    }
  }
  return parents;
}

// 品號改名時同步更新 BOM join key（children/parents/assemblySet）
export function renamePartNo(oldNo: string, newNo: string): void {
  if (!oldNo || oldNo === newNo) return;
  const nextChildren: Record<string, string[]> = {};
  for (const [key, comps] of Object.entries(childrenMap)) {
    const newKey = key === oldNo ? newNo : key;
    const nextComps = comps.map(c => c === oldNo ? newNo : c);
    if (nextChildren[newKey]) {
      nextChildren[newKey] = Array.from(new Set([...nextChildren[newKey], ...nextComps]));
    } else {
      nextChildren[newKey] = nextComps;
    }
  }
  childrenMap = nextChildren;
  parentsMap = computeParentsMap(nextChildren);
  assemblySet = new Set(Object.keys(nextChildren));
}

export interface BOMRelation {
  relatedItem: PartItem;
  relationType: 'child_component' | 'parent_assembly';
  note: string;
}

export function getItemType(item: PartItem): ItemType {
  return isAssemblyPartNo(item.partNo) ? 'assembly' : 'part';
}

export function getBOMChildren(): Record<string, string[]> {
  return childrenMap;
}

export function getBOMParents(): Record<string, string[]> {
  return parentsMap;
}

function findPartByNo(partNo: string, allParts: PartItem[]): PartItem | undefined {
  return allParts.find(
    (p) =>
      p.partNo === partNo ||
      p.id === partNo ||
      (p.alternates ?? []).some((a) => a === partNo)
  );
}

function resolveChildrenRecursive(
  assemblyPartNo: string,
  allParts: PartItem[],
  visited: Set<string>,
  depth: number
): BOMRelation[] {
  const results: BOMRelation[] = [];
  if (depth > 5 || visited.has(assemblyPartNo)) return results;
  visited.add(assemblyPartNo);

  const children = childrenMap[assemblyPartNo];
  if (!children) return results;

  for (const childNo of children) {
    const part = findPartByNo(childNo, allParts);
    if (part) {
      results.push({
        relatedItem: part,
        relationType: 'child_component',
        note: `構成組件 (${childNo})`,
      });
    }
    if (isAssemblyPartNo(childNo)) {
      const subComponents = resolveChildrenRecursive(childNo, allParts, visited, depth + 1);
      for (const sub of subComponents) {
        if (!results.some((r) => r.relatedItem.id === sub.relatedItem.id)) {
          results.push(sub);
        }
      }
    }
  }
  return results;
}

export function getComponentsForAssembly(
  assembly: PartItem,
  allParts: PartItem[]
): BOMRelation[] {
  const results: BOMRelation[] = [];
  const addedIds = new Set<string>();

  if (assembly.components && assembly.components.length > 0) {
    for (const cRef of assembly.components) {
      const match = allParts.find(
        (p) =>
          p.partNo === cRef ||
          p.name === cRef ||
          p.id === cRef ||
          (p.alternates ?? []).some((a) => a === cRef)
      );
      if (match && !addedIds.has(match.id)) {
        addedIds.add(match.id);
        results.push({
          relatedItem: match,
          relationType: 'child_component',
          note: '自訂物料單 (Direct BOM Link)',
        });
      }
    }
  }

  const visited = new Set<string>();
  const bomComponents = resolveChildrenRecursive(assembly.partNo, allParts, visited, 0);
  for (const comp of bomComponents) {
    if (!addedIds.has(comp.relatedItem.id)) {
      addedIds.add(comp.relatedItem.id);
      results.push(comp);
    }
  }
  return results;
}

function resolveParentsRecursive(
  partNo: string,
  allParts: PartItem[],
  visited: Set<string>,
  depth: number
): BOMRelation[] {
  const results: BOMRelation[] = [];
  if (depth > 5 || visited.has(partNo)) return results;
  visited.add(partNo);

  const parents = parentsMap[partNo];
  if (!parents) return results;

  for (const parentNo of parents) {
    const parent = findPartByNo(parentNo, allParts);
    if (parent) {
      results.push({
        relatedItem: parent,
        relationType: 'parent_assembly',
        note: `可組成 ${parent.name}`,
      });
    }
    if (isAssemblyPartNo(parentNo)) {
      const grandParents = resolveParentsRecursive(parentNo, allParts, visited, depth + 1);
      for (const gp of grandParents) {
        if (!results.some((r) => r.relatedItem.id === gp.relatedItem.id)) {
          results.push(gp);
        }
      }
    }
  }
  return results;
}

export function getAssembliesForPart(
  part: PartItem,
  allParts: PartItem[]
): BOMRelation[] {
  const results: BOMRelation[] = [];
  const addedIds = new Set<string>();

  if (part.usedInAssemblies && part.usedInAssemblies.length > 0) {
    for (const aRef of part.usedInAssemblies) {
      const match = allParts.find(
        (p) =>
          p.partNo === aRef ||
          p.name === aRef ||
          p.id === aRef ||
          (p.alternates ?? []).some((a) => a === aRef)
      );
      if (match && !addedIds.has(match.id)) {
        addedIds.add(match.id);
        results.push({
          relatedItem: match,
          relationType: 'parent_assembly',
          note: '可組成之目標組件 (Explicit Target)',
        });
      }
    }
  }

  const visited = new Set<string>();
  const parentAssemblies = resolveParentsRecursive(part.partNo, allParts, visited, 0);
  for (const pa of parentAssemblies) {
    if (!addedIds.has(pa.relatedItem.id)) {
      addedIds.add(pa.relatedItem.id);
      results.push(pa);
    }
  }
  return results;
}
