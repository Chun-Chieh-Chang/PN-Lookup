import { PartItem, ItemType } from '../types';
import { BOM_CHILDREN as STATIC_CHILDREN, BOM_PARENTS as STATIC_PARENTS, ASSEMBLY_PART_NOS as STATIC_ASSEMBLIES } from '../data/bomData';
import { loadBOM } from './bomService';

let childrenMap: Record<string, string[]> = STATIC_CHILDREN;
let parentsMap: Record<string, string[]> = STATIC_PARENTS;
let assemblySet: Set<string> = STATIC_ASSEMBLIES;

let initPromise: Promise<void> | null = null;

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
    const isAssembly = assemblySet.has(p.partNo) || assemblySet.has(p.partNo.toUpperCase());
    const children = childrenMap[p.partNo] || childrenMap[p.partNo.toUpperCase()];
    const parents = parentsMap[p.partNo] || parentsMap[p.partNo.toUpperCase()];
    return {
      ...p,
      itemType: p.itemType || (isAssembly ? 'assembly' as const : 'part' as const),
      components: p.components && p.components.length > 0 ? p.components : (children ? [...children] : undefined),
      usedInAssemblies: p.usedInAssemblies && p.usedInAssemblies.length > 0 ? p.usedInAssemblies : (parents ? [...parents] : undefined),
    };
  });
}

export interface BOMRelation {
  relatedItem: PartItem;
  relationType: 'child_component' | 'parent_assembly';
  note: string;
}

export function getItemType(item: PartItem): ItemType {
  if (item.itemType) return item.itemType;
  const upperPartNo = item.partNo.toUpperCase();
  if (assemblySet.has(upperPartNo) || assemblySet.has(item.partNo)) return 'assembly';
  return 'part';
}

export function getBOMChildren(): Record<string, string[]> {
  return childrenMap;
}

export function getBOMParents(): Record<string, string[]> {
  return parentsMap;
}

function findPartByNo(partNo: string, allParts: PartItem[]): PartItem | undefined {
  return allParts.find((p) => p.partNo === partNo || p.id === partNo);
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
    if (assemblySet.has(childNo)) {
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
        (p) => p.partNo === cRef || p.name === cRef || p.id === cRef
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
    if (assemblySet.has(parentNo)) {
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
        (p) => p.partNo === aRef || p.name === aRef || p.id === aRef
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
