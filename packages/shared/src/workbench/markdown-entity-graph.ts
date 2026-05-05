import { z } from 'zod';

const EDGE_TYPES = ['mentions', 'references', 'tags'] as const;
const NODE_TYPES = ['document', 'heading', 'entity', 'reference', 'tag'] as const;

export const MarkdownEntityGraphNodeTypeSchema = z.enum(NODE_TYPES);
export type MarkdownEntityGraphNodeType = z.infer<typeof MarkdownEntityGraphNodeTypeSchema>;

export const MarkdownEntityGraphEdgeTypeSchema = z.enum(EDGE_TYPES);
export type MarkdownEntityGraphEdgeType = z.infer<typeof MarkdownEntityGraphEdgeTypeSchema>;

export const MarkdownEntityGraphNodeSchema = z.object({
  id: z.string().trim().min(1),
  type: MarkdownEntityGraphNodeTypeSchema,
  label: z.string().trim().min(1),
  value: z.string().trim().min(1),
  line: z.number().int().positive().optional(),
  level: z.number().int().min(1).max(6).optional(),
});
export type MarkdownEntityGraphNode = z.infer<typeof MarkdownEntityGraphNodeSchema>;

export const MarkdownEntityGraphEdgeSchema = z.object({
  id: z.string().trim().min(1),
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  type: MarkdownEntityGraphEdgeTypeSchema,
});
export type MarkdownEntityGraphEdge = z.infer<typeof MarkdownEntityGraphEdgeSchema>;

export const MarkdownEntityGraphSchema = z.object({
  documentId: z.string().trim().min(1),
  title: z.string().trim().min(1).optional(),
  nodes: z.array(MarkdownEntityGraphNodeSchema),
  edges: z.array(MarkdownEntityGraphEdgeSchema),
});
export type MarkdownEntityGraph = z.infer<typeof MarkdownEntityGraphSchema>;

export interface BuildMarkdownEntityGraphInput {
  documentId: string;
  title?: string;
  markdown: string;
}

export interface MarkdownEntityGraphSummary {
  documentId: string;
  nodeCount: number;
  edgeCount: number;
  nodesByType: Record<MarkdownEntityGraphNodeType, number>;
  edgesByType: Record<MarkdownEntityGraphEdgeType, number>;
}

const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const WIKILINK_PATTERN = /\[\[([^\]\n|#]+)(?:#[^\]\n|]+)?(?:\|[^\]\n]+)?\]\]/g;
const MARKDOWN_LINK_PATTERN = /!?\[([^\]\n]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
const TAG_PATTERN = /(^|[\s([{:])#([A-Za-z0-9][A-Za-z0-9_-]*)\b/g;

function slugify(value: string, fallback = 'item'): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
}

function addNode(nodes: Map<string, MarkdownEntityGraphNode>, node: MarkdownEntityGraphNode): void {
  if (!nodes.has(node.id)) {
    nodes.set(node.id, node);
  }
}

function addEdge(
  edges: Map<string, MarkdownEntityGraphEdge>,
  from: string,
  to: string,
  type: MarkdownEntityGraphEdgeType,
): void {
  const id = `${from}->${to}:${type}`;
  if (!edges.has(id)) {
    edges.set(id, { id, from, to, type });
  }
}

function uniqueHeadingId(baseId: string, usedIds: Set<string>): string {
  if (!usedIds.has(baseId)) {
    usedIds.add(baseId);
    return baseId;
  }

  let suffix = 2;
  while (usedIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  const id = `${baseId}-${suffix}`;
  usedIds.add(id);
  return id;
}

function createTypeCounts<T extends string>(types: readonly T[]): Record<T, number> {
  return Object.fromEntries(types.map((type) => [type, 0])) as Record<T, number>;
}

function maskInlineCode(line: string): string {
  return line.replace(/`+[^`]*`+/g, ' ');
}

export function buildMarkdownEntityGraph(input: BuildMarkdownEntityGraphInput): MarkdownEntityGraph {
  const documentId = input.documentId.trim();
  if (!documentId) {
    throw new Error('documentId is required');
  }

  const documentNodeId = `document:${slugify(documentId, 'document')}`;
  const nodes = new Map<string, MarkdownEntityGraphNode>();
  const edges = new Map<string, MarkdownEntityGraphEdge>();
  const usedHeadingIds = new Set<string>();
  let currentSourceId = documentNodeId;
  let inFence = false;

  addNode(nodes, {
    id: documentNodeId,
    type: 'document',
    label: input.title?.trim() || documentId,
    value: documentId,
  });

  input.markdown.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmedLine = line.trim();

    if (/^```/.test(trimmedLine) || /^~~~/.test(trimmedLine)) {
      inFence = !inFence;
      return;
    }

    if (inFence) {
      return;
    }

    const headingMatch = HEADING_PATTERN.exec(trimmedLine);
    if (headingMatch?.[1] && headingMatch[2]) {
      const label = headingMatch[2].trim();
      const headingId = uniqueHeadingId(`heading:${slugify(label, 'heading')}`, usedHeadingIds);
      currentSourceId = headingId;
      addNode(nodes, {
        id: headingId,
        type: 'heading',
        label,
        value: label,
        line: lineNumber,
        level: headingMatch[1].length,
      });
      return;
    }

    const parseLine = maskInlineCode(line);

    for (const match of parseLine.matchAll(WIKILINK_PATTERN)) {
      const value = match[1]?.trim();
      if (!value) continue;

      const nodeId = `entity:${slugify(value, 'entity')}`;
      addNode(nodes, {
        id: nodeId,
        type: 'entity',
        label: value,
        value,
      });
      addEdge(edges, currentSourceId, nodeId, 'mentions');
    }

    for (const match of parseLine.matchAll(MARKDOWN_LINK_PATTERN)) {
      if (match[0].startsWith('!')) continue;

      const label = match[1]?.trim();
      const value = match[2]?.trim();
      if (!label || !value) continue;

      const nodeId = `reference:${slugify(value, 'reference')}`;
      addNode(nodes, {
        id: nodeId,
        type: 'reference',
        label,
        value,
      });
      addEdge(edges, currentSourceId, nodeId, 'references');
    }

    for (const match of parseLine.matchAll(TAG_PATTERN)) {
      const value = match[2]?.trim();
      if (!value) continue;

      const nodeId = `tag:${slugify(value, 'tag')}`;
      addNode(nodes, {
        id: nodeId,
        type: 'tag',
        label: `#${value}`,
        value,
      });
      addEdge(edges, currentSourceId, nodeId, 'tags');
    }
  });

  return MarkdownEntityGraphSchema.parse({
    documentId,
    title: input.title?.trim() || undefined,
    nodes: [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...edges.values()].sort((left, right) => left.id.localeCompare(right.id)),
  });
}

export function summarizeMarkdownEntityGraph(graph: MarkdownEntityGraph): MarkdownEntityGraphSummary {
  const parsed = MarkdownEntityGraphSchema.parse(graph);
  const nodesByType = createTypeCounts(NODE_TYPES);
  const edgesByType = createTypeCounts(EDGE_TYPES);

  for (const node of parsed.nodes) {
    nodesByType[node.type] += 1;
  }

  for (const edge of parsed.edges) {
    edgesByType[edge.type] += 1;
  }

  return {
    documentId: parsed.documentId,
    nodeCount: parsed.nodes.length,
    edgeCount: parsed.edges.length,
    nodesByType,
    edgesByType,
  };
}
