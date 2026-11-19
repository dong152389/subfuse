import { formatNodeNameFromTemplate } from "../node-name-template";
import { buildNodeContentKey, buildScopedNodeIdentityKey } from "../node-identity";
import { stripImportedNodeControlFields } from "./imported-node-controls";
import {
  getNodeOriginName,
  getNodeSourceIds,
  makeUniqueName,
  normalizeNodeOriginName,
  ORIGIN_NAME_KEY,
  SOURCE_IDS_KEY,
  withoutNodeSourceIds,
} from "./node-source-state";
import {
  buildDynamicNodeFingerprint,
  getSubscriptionInfoNodeCategory,
  isDynamicFingerprintEligible,
} from "./info-node-name";
import type { ParsedNode } from "../types/node";

export type SourceRefreshDescriptor = {
  sourceId: string;
  currentTag?: string;
  currentNameTemplate?: string;
  lastTag?: string;
  lastNameTemplate?: string;
  treatAsNewSource?: boolean;
  smartNodeMatchingEnabled?: boolean;
  deletedNodes?: DeletedNodeDescriptor[];
};

export type MergeSourceNodesResult = {
  nodes: ParsedNode[];
  renameMap: Map<string, string>;
  deletedNodes?: DeletedNodeDescriptor[];
  deletedNodeNames?: string[];
};

export type DeletedNodeDescriptor = {
  originName?: unknown;
  name?: unknown;
  node?: ParsedNode;
  sourceIds?: string[];
};

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function prepareSourceParsedNodes(
  nodes: ParsedNode[],
  descriptor: Pick<SourceRefreshDescriptor, "currentTag" | "currentNameTemplate">
): ParsedNode[] {
  const tag = normalizeOptionalString(descriptor.currentTag);
  const template = normalizeOptionalString(descriptor.currentNameTemplate);

  return nodes.map((node) => {
    const sanitizedNode = stripImportedNodeControlFields(node);
    const record = sanitizedNode as unknown as Record<string, unknown>;
    const originName = getNodeOriginName(sanitizedNode).trim();

    const displayName = formatNodeNameFromTemplate({
      originName,
      tag,
      template,
    });

    return ({
      ...record,
      name: displayName || originName,
      [ORIGIN_NAME_KEY]: originName,
    } as unknown as ParsedNode);
  });
}

export function detachSourceNodesFromState(
  stateNodes: ParsedNode[],
  sourceId: string
): MergeSourceNodesResult {
  const removed = new Set([sourceId]);
  const nextNodes: ParsedNode[] = [];

  for (const rawNode of stateNodes) {
    const node = normalizeNodeOriginName(rawNode);
    const next = withoutNodeSourceIds(node, removed);
    if (next) nextNodes.push(next);
  }

  return { nodes: nextNodes, renameMap: new Map<string, string>() };
}

export function mergeParsedSourceNodes(
  stateNodes: ParsedNode[],
  parsedNodes: ParsedNode[],
  deletedNodeNames: string[],
  descriptor: SourceRefreshDescriptor
): MergeSourceNodesResult {
  const sourceId = descriptor.sourceId;
  const lastTag = normalizeOptionalString(descriptor.lastTag);
  const lastNameTemplate = normalizeOptionalString(descriptor.lastNameTemplate);
  const treatAsNewSource = descriptor.treatAsNewSource === true;
  const smartNodeMatchingEnabled = descriptor.smartNodeMatchingEnabled !== false;

  const originOf = (node: ParsedNode) => getNodeOriginName(node).trim() || node.name;
  const keyOf = (node: ParsedNode) => buildScopedNodeIdentityKey(originOf(node), node);

  const mergeUnique = (map: Map<string, string | null>, key: string, value: string) => {
    const existed = map.get(key);
    if (existed === undefined) {
      map.set(key, value);
      return;
    }
    if (existed === value || existed === null) return;
    map.set(key, null);
  };

  const deleted = new Set(
    deletedNodeNames
      .filter((name) => typeof name === "string")
      .map((name) => name.trim())
      .filter(Boolean)
  );
  const deletedNodeKeys = new Set<string>();
  const deletedInfoCategories = new Set<string>();
  const deletedInfoCategoriesBySourceId = new Map<string, Set<string>>();
  const deletedDynamicFingerprints = new Set<string>();
  const deletedDynamicFingerprintsBySourceId = new Map<string, Set<string>>();

  const registerDeletedInfoCategory = (cat: string | null, sourceIds?: string[]) => {
    if (!cat) return;
    deletedInfoCategories.add(cat);
    if (Array.isArray(sourceIds) && sourceIds.length > 0) {
      for (const sid of sourceIds) {
        if (!sid) continue;
        let set = deletedInfoCategoriesBySourceId.get(sid);
        if (!set) {
          set = new Set();
          deletedInfoCategoriesBySourceId.set(sid, set);
        }
        set.add(cat);
      }
    }
  };

  const registerDeletedDynamicFingerprint = (fp: string | null, sourceIds?: string[]) => {
    if (!fp || (!fp.includes("<num>") && !fp.includes("<date>"))) return;
    deletedDynamicFingerprints.add(fp);
    if (Array.isArray(sourceIds) && sourceIds.length > 0) {
      for (const sid of sourceIds) {
        if (!sid) continue;
        let set = deletedDynamicFingerprintsBySourceId.get(sid);
        if (!set) {
          set = new Set();
          deletedDynamicFingerprintsBySourceId.set(sid, set);
        }
        set.add(fp);
      }
    }
  };

  for (const item of Array.isArray(descriptor.deletedNodes) ? descriptor.deletedNodes : []) {
    const rawOrigin = normalizeOptionalString(item?.originName);
    const rawName = normalizeOptionalString(item?.name);
    const itemNode = item?.node ? normalizeNodeOriginName(item.node) : undefined;
    if (itemNode) {
      const origin = rawOrigin ?? (getNodeOriginName(itemNode).trim() || itemNode.name);
      if (origin) {
        deletedNodeKeys.add(buildScopedNodeIdentityKey(origin, itemNode));
      }
    }
    const cat =
      getSubscriptionInfoNodeCategory(rawOrigin ?? "") ??
      getSubscriptionInfoNodeCategory(rawName ?? "") ??
      (itemNode ? getSubscriptionInfoNodeCategory(itemNode.name) : null);
    const sourceIds = Array.isArray((item as any)?.sourceIds)
      ? (item as any).sourceIds
      : itemNode
        ? getNodeSourceIds(itemNode)
        : undefined;
    registerDeletedInfoCategory(cat, sourceIds);

    const eligible = isDynamicFingerprintEligible(itemNode ?? { name: rawName || rawOrigin });
    if (eligible) {
      const fp =
        buildDynamicNodeFingerprint(rawOrigin ?? "") ??
        buildDynamicNodeFingerprint(rawName ?? "") ??
        (itemNode ? buildDynamicNodeFingerprint(itemNode.name) : null);
      registerDeletedDynamicFingerprint(fp, sourceIds);
    }
  }

  for (const rawName of deleted) {
    const cat = getSubscriptionInfoNodeCategory(rawName);
    registerDeletedInfoCategory(cat);
    if (cat) {
      const fp = buildDynamicNodeFingerprint(rawName);
      registerDeletedDynamicFingerprint(fp);
    }
  }

  const freshOriginCounts = new Map<string, number>();
  for (const rawNode of parsedNodes) {
    const node = normalizeNodeOriginName(rawNode);
    const origin = originOf(node);
    if (!origin) continue;
    freshOriginCounts.set(origin, (freshOriginCounts.get(origin) ?? 0) + 1);
  }

  const matchedDeletedInfoNodes = new Map<string, ParsedNode>();

  const isDeleted = (node: ParsedNode, originNameRaw: string, displayNameRaw?: string): boolean => {
    const originName = (originNameRaw || "").trim();
    if (!originName) return false;
    if (deletedNodeKeys.has(buildScopedNodeIdentityKey(originName, node))) return true;

    const nodeCategory =
      getSubscriptionInfoNodeCategory(originName) ??
      getSubscriptionInfoNodeCategory(node.name) ??
      (displayNameRaw ? getSubscriptionInfoNodeCategory(displayNameRaw) : null);

    if (nodeCategory) {
      const sourceSpecific = deletedInfoCategoriesBySourceId.get(sourceId);
      const isCategoryDeleted =
        (sourceSpecific && sourceSpecific.has(nodeCategory)) ||
        deletedInfoCategories.has(nodeCategory);
      if (isCategoryDeleted) {
        matchedDeletedInfoNodes.set(nodeCategory, node);
        return true;
      }
    }

    if (isDynamicFingerprintEligible(node)) {
      const nodeFp =
        buildDynamicNodeFingerprint(originName) ??
        buildDynamicNodeFingerprint(node.name) ??
        (displayNameRaw ? buildDynamicNodeFingerprint(displayNameRaw) : null);
      if (nodeFp && (nodeFp.includes("<num>") || nodeFp.includes("<date>"))) {
        const sourceSpecificFp = deletedDynamicFingerprintsBySourceId.get(sourceId);
        const isFpDeleted =
          (sourceSpecificFp && sourceSpecificFp.has(nodeFp)) ||
          deletedDynamicFingerprints.has(nodeFp);
        if (isFpDeleted) {
          matchedDeletedInfoNodes.set(`fp:${nodeFp}`, node);
          return true;
        }
      }
    }

    // Legacy deletedNodeNames are only origin/display-name markers. When a source
    // emits many distinct nodes with the same default origin name, a single
    // coarse marker must not hide the entire batch.
    if ((freshOriginCounts.get(originName) ?? 0) > 1) return false;

    if (deleted.has(originName)) return true;

    const displayName = typeof displayNameRaw === "string" ? displayNameRaw.trim() : "";
    if (displayName && deleted.has(displayName)) return true;

    const previousAutoName = formatNodeNameFromTemplate({
      originName,
      tag: lastTag,
      template: lastNameTemplate,
    });
    return Boolean(previousAutoName && deleted.has(previousAutoName));
  };

  const freshOrdered: ParsedNode[] = [];
  const freshSeenKeys = new Set<string>();
  const freshOriginNames = new Set<string>();
  const freshByOrigin = new Map<string, ParsedNode[]>();
  const freshKeyToOriginName = new Map<string, string | null>();
  const freshKeyWithoutServerToOriginName = new Map<string, string | null>();
  const freshKeyWithoutServerPortToOriginName = new Map<string, string | null>();
  const freshKeyWithoutAddressToOriginName = new Map<string, string | null>();

  for (const rawNode of parsedNodes) {
    const node = normalizeNodeOriginName(rawNode);
    const origin = originOf(node);
    if (!origin) continue;
    if (isDeleted(node, origin, node.name)) continue;

    const key = keyOf(node);
    if (freshSeenKeys.has(key)) continue;
    freshSeenKeys.add(key);

    freshOrdered.push(node);
    freshOriginNames.add(origin);
    const list = freshByOrigin.get(origin) ?? [];
    list.push(node);
    freshByOrigin.set(origin, list);
    mergeUnique(freshKeyToOriginName, buildNodeContentKey(node), origin);
    mergeUnique(freshKeyWithoutServerToOriginName, buildNodeContentKey(node, { ignoreServer: true }), origin);
    mergeUnique(
      freshKeyWithoutServerPortToOriginName,
      buildNodeContentKey(node, { ignoreServer: true, ignorePort: true }),
      origin
    );
    mergeUnique(
      freshKeyWithoutAddressToOriginName,
      buildNodeContentKey(node, {
        ignoreServer: true,
        ignorePort: true,
        ignoreSni: true,
        ignoreServername: true,
      }),
      origin
    );
  }

  const resolve = (value: string | null | undefined) =>
    typeof value === "string" && value.trim() ? value.trim() : null;

  const inferMatchingOriginName = (node: ParsedNode): string | null => {
    if (!smartNodeMatchingEnabled) return null;

    const inferred =
      resolve(freshKeyToOriginName.get(buildNodeContentKey(node))) ??
      resolve(freshKeyWithoutServerToOriginName.get(buildNodeContentKey(node, { ignoreServer: true }))) ??
      resolve(
        freshKeyWithoutServerPortToOriginName.get(
          buildNodeContentKey(node, { ignoreServer: true, ignorePort: true })
        )
      ) ??
      resolve(
        freshKeyWithoutAddressToOriginName.get(
          buildNodeContentKey(node, {
            ignoreServer: true,
            ignorePort: true,
            ignoreSni: true,
            ignoreServername: true,
          })
        )
      );
    return inferred && freshOriginNames.has(inferred) ? inferred : null;
  };

  const isUserRenamed = (nodeName: string, originName: string) => {
    if (treatAsNewSource) return false;
    const previousAutoName = formatNodeNameFromTemplate({
      originName,
      tag: lastTag,
      template: lastNameTemplate,
    });
    return nodeName !== previousAutoName;
  };

  const hasExplicitOriginName = (node: ParsedNode): boolean => {
    const record = node as unknown as Record<string, unknown>;
    return typeof record[ORIGIN_NAME_KEY] === "string" && String(record[ORIGIN_NAME_KEY]).trim().length > 0;
  };

  const resolveOriginName = (
    node: ParsedNode,
    options: { allowDisplayNameFallback: boolean }
  ): string | null => {
    const record = node as unknown as Record<string, unknown>;
    const originRaw =
      typeof record[ORIGIN_NAME_KEY] === "string" && String(record[ORIGIN_NAME_KEY]).trim()
        ? String(record[ORIGIN_NAME_KEY]).trim()
        : "";

    const inferred = inferMatchingOriginName(node);
    if (originRaw && freshOriginNames.has(originRaw)) return originRaw;
    if (inferred) return inferred;

    const candidate = (node.name || "").trim();
    if (options.allowDisplayNameFallback && candidate && freshOriginNames.has(candidate)) {
      const sameTypeExists = freshOrdered.some((item) => originOf(item) === candidate && item.type === node.type);
      if (sameTypeExists) return candidate;
    }

    return originRaw ? originRaw : null;
  };

  const buildNextSourceIds = (existingSourceIds: string[]): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    const push = (raw: string) => {
      const sid = (raw || "").trim();
      if (!sid || seen.has(sid)) return;
      seen.add(sid);
      out.push(sid);
    };
    for (const id of existingSourceIds) push(id);
    push(sourceId);
    return out;
  };

  const mergeNodeWithFresh = (params: {
    stored: ParsedNode;
    fresh: ParsedNode;
    originName: string;
    desiredName: string;
    extraSourceIds: string[];
  }): ParsedNode => {
    const storedRecord = params.stored as unknown as Record<string, unknown>;
    const freshRecord = params.fresh as unknown as Record<string, unknown>;
    const preservedExtra = Object.fromEntries(
      Object.entries(storedRecord).filter(
        ([key]) => key.startsWith("_") && key !== ORIGIN_NAME_KEY && key !== SOURCE_IDS_KEY
      )
    );

    return ({
      ...freshRecord,
      ...preservedExtra,
      name: params.desiredName,
      [ORIGIN_NAME_KEY]: params.originName,
      [SOURCE_IDS_KEY]: buildNextSourceIds(params.extraSourceIds),
    } as unknown as ParsedNode);
  };

  const consumedFreshKeys = new Set<string>();
  const originConsumed = new Map<string, number>();
  const takeFresh = (originName: string): ParsedNode | null => {
    const list = freshByOrigin.get(originName);
    if (!list || list.length === 0) return null;
    const idx = originConsumed.get(originName) ?? 0;
    if (idx >= list.length) return null;
    originConsumed.set(originName, idx + 1);
    const fresh = list[idx];
    consumedFreshKeys.add(keyOf(fresh));
    return fresh;
  };

  const removed = new Set([sourceId]);
  const baseNodes: ParsedNode[] = [];
  const baseOldNames: Array<string | null> = [];
  const baseFixed: boolean[] = [];
  let hadExistingSourceNodes = false;

  const pushPlanned = (node: ParsedNode, oldName: string | null, fixedName: boolean) => {
    baseNodes.push(node);
    baseOldNames.push(oldName);
    baseFixed.push(fixedName);
  };

  for (const rawNode of stateNodes) {
    const explicitOriginName = hasExplicitOriginName(rawNode);
    const node = normalizeNodeOriginName(rawNode);
    const sourceIds = getNodeSourceIds(node);
    const allowDisplayNameFallback = smartNodeMatchingEnabled || !explicitOriginName;

    if (sourceIds.includes(sourceId)) {
      hadExistingSourceNodes = true;
      const previousOriginName = originOf(node);
      const originName = resolveOriginName(node, { allowDisplayNameFallback }) ?? previousOriginName;
      const fresh = originName ? takeFresh(originName) : null;

      const base = withoutNodeSourceIds(node, removed);
      if (!fresh) {
        if (base) pushPlanned(base, base.name, true);
        continue;
      }

      const keepUserName = previousOriginName ? isUserRenamed(node.name, previousOriginName) : false;
      const desiredName = keepUserName ? node.name : fresh.name;
      const extraIds = base ? getNodeSourceIds(base) : sourceIds.filter((id) => id !== sourceId);

      const merged = mergeNodeWithFresh({
        stored: node,
        fresh,
        originName: originName || originOf(fresh),
        desiredName,
        extraSourceIds: extraIds,
      });
      pushPlanned(merged, node.name, keepUserName);
      continue;
    }

    if (sourceIds.length === 0 && freshOriginNames.size > 0) {
      const originName = resolveOriginName(node, { allowDisplayNameFallback });
      if (originName && freshOriginNames.has(originName)) {
        hadExistingSourceNodes = true;
        const fresh = takeFresh(originName);
        if (!fresh) {
          continue;
        }

        const keepUserName = isUserRenamed(node.name, originName);
        const desiredName = keepUserName ? node.name : fresh.name;
        const merged = mergeNodeWithFresh({
          stored: node,
          fresh,
          originName,
          desiredName,
          extraSourceIds: [],
        });
        pushPlanned(merged, node.name, keepUserName);
        continue;
      }
    }

    pushPlanned(node, node.name, true);
  }

  const baseKeyToIndex = new Map<string, number>();
  baseNodes.forEach((node, idx) => baseKeyToIndex.set(keyOf(node), idx));

  const newNodes: ParsedNode[] = [];
  for (const node of freshOrdered) {
    const key = keyOf(node);
    if (consumedFreshKeys.has(key)) continue;

    const existingIndex = smartNodeMatchingEnabled ? baseKeyToIndex.get(key) : undefined;
    if (existingIndex !== undefined) {
      const existing = baseNodes[existingIndex];
      baseNodes[existingIndex] = mergeNodeWithFresh({
        stored: existing,
        fresh: node,
        originName: originOf(node),
        desiredName: existing.name,
        extraSourceIds: getNodeSourceIds(existing),
      });
      continue;
    }

    const record = node as unknown as Record<string, unknown>;
    const originName = originOf(node);
    newNodes.push(
      ({
        ...record,
        [ORIGIN_NAME_KEY]: originName,
        [SOURCE_IDS_KEY]: [sourceId],
      } as unknown as ParsedNode)
    );
  }

  const insertionIndex = (() => {
    if (!hadExistingSourceNodes) return baseNodes.length;
    for (let i = baseNodes.length - 1; i >= 0; i -= 1) {
      if (getNodeSourceIds(baseNodes[i]).includes(sourceId)) return i + 1;
    }
    return baseNodes.length;
  })();

  const combinedNodes =
    newNodes.length > 0
      ? [...baseNodes.slice(0, insertionIndex), ...newNodes, ...baseNodes.slice(insertionIndex)]
      : baseNodes;
  const combinedOldNames =
    newNodes.length > 0
      ? [...baseOldNames.slice(0, insertionIndex), ...new Array(newNodes.length).fill(null), ...baseOldNames.slice(insertionIndex)]
      : baseOldNames;
  const combinedFixed =
    newNodes.length > 0
      ? [...baseFixed.slice(0, insertionIndex), ...new Array(newNodes.length).fill(false), ...baseFixed.slice(insertionIndex)]
      : baseFixed;

  const renameMap = new Map<string, string>();
  const usedNames = new Set<string>();
  const nextNodes = combinedNodes.map((node) => node);

  const setNodeName = (idx: number, nextName: string) => {
    const node = nextNodes[idx];
    if (node.name === nextName) return;
    const record = node as unknown as Record<string, unknown>;
    nextNodes[idx] = ({ ...record, name: nextName } as unknown as ParsedNode);
  };

  for (let i = 0; i < nextNodes.length; i += 1) {
    if (!combinedFixed[i]) continue;
    const desired = nextNodes[i].name;
    const finalName = makeUniqueName(desired, usedNames);
    usedNames.add(finalName);
    setNodeName(i, finalName);
    const oldName = combinedOldNames[i];
    if (oldName && finalName !== oldName) renameMap.set(oldName, finalName);
  }

  for (let i = 0; i < nextNodes.length; i += 1) {
    if (combinedFixed[i]) continue;
    const desired = nextNodes[i].name;
    const finalName = makeUniqueName(desired, usedNames);
    usedNames.add(finalName);
    setNodeName(i, finalName);
    const oldName = combinedOldNames[i];
    if (oldName && finalName !== oldName) renameMap.set(oldName, finalName);
  }

  let updatedDeletedNodes: DeletedNodeDescriptor[] | undefined;
  let updatedDeletedNodeNames: string[] | undefined;

  if (matchedDeletedInfoNodes.size > 0 && Array.isArray(descriptor.deletedNodes)) {
    const nextDeletedNodes: DeletedNodeDescriptor[] = [];
    const handledCategories = new Set<string>();

    for (const item of descriptor.deletedNodes) {
      if (!item) continue;
      const rawOrigin = normalizeOptionalString(item.originName) ?? "";
      const rawName = normalizeOptionalString(item.name) ?? "";
      const itemNode = item.node ? normalizeNodeOriginName(item.node) : undefined;
      const cat =
        getSubscriptionInfoNodeCategory(rawOrigin) ??
        getSubscriptionInfoNodeCategory(rawName) ??
        (itemNode ? getSubscriptionInfoNodeCategory(itemNode.name) : null);
      const eligible = isDynamicFingerprintEligible(itemNode ?? { name: rawName || rawOrigin });
      const fp = eligible
        ? buildDynamicNodeFingerprint(rawOrigin) ??
          buildDynamicNodeFingerprint(rawName) ??
          (itemNode ? buildDynamicNodeFingerprint(itemNode.name) : null)
        : null;
      const fpKey = fp && (fp.includes("<num>") || fp.includes("<date>")) ? `fp:${fp}` : null;

      const matchKey =
        cat && matchedDeletedInfoNodes.has(cat)
          ? cat
          : fpKey && matchedDeletedInfoNodes.has(fpKey)
            ? fpKey
            : null;

      if (matchKey) {
        if (!handledCategories.has(matchKey)) {
          handledCategories.add(matchKey);
          const freshNode = matchedDeletedInfoNodes.get(matchKey)!;
          const freshOrigin = originOf(freshNode);
          nextDeletedNodes.push({
            originName: freshOrigin,
            name: freshNode.name || freshOrigin,
            node: freshNode,
            sourceIds: [sourceId],
          });
        }
      } else {
        nextDeletedNodes.push(item);
      }
    }

    updatedDeletedNodes = nextDeletedNodes;

    const nextNames = new Set(deletedNodeNames);
    for (const [key, freshNode] of matchedDeletedInfoNodes.entries()) {
      for (const name of Array.from(nextNames)) {
        if (key.startsWith("fp:")) {
          const targetFp = key.slice(3);
          const nameFp = buildDynamicNodeFingerprint(name);
          if (nameFp === targetFp) {
            nextNames.delete(name);
          }
        } else if (getSubscriptionInfoNodeCategory(name) === key) {
          nextNames.delete(name);
        }
      }
      nextNames.add(originOf(freshNode));
    }
    updatedDeletedNodeNames = Array.from(nextNames);
  }

  return {
    nodes: nextNodes,
    renameMap,
    ...(updatedDeletedNodes ? { deletedNodes: updatedDeletedNodes } : {}),
    ...(updatedDeletedNodeNames ? { deletedNodeNames: updatedDeletedNodeNames } : {}),
  };
}
