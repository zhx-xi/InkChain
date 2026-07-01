import dagre from "@dagrejs/dagre";
import type { GraphNodeData, GraphEdgeData } from "../../store/relations/types";

export interface LayoutNode extends GraphNodeData {
  x: number;
  y: number;
  nodeWidth: number;
  nodeHeight: number;
}

const DEFAULT_NODE_WIDTH = 160;
const DEFAULT_NODE_HEIGHT = 50;

/**
 * Compute a dagre-directed-graph layout for relation graph nodes.
 *
 * @param nodes  - The graph nodes (no position data required).
 * @param edges  - The graph edges.
 * @param direction - Layout direction: "LR" (left-to-right) or "TB" (top-to-bottom).
 * @returns Nodes augmented with `x`, `y`, `nodeWidth`, `nodeHeight`.
 */
export function getLayout(
  nodes: ReadonlyArray<GraphNodeData>,
  edges: ReadonlyArray<GraphEdgeData>,
  direction: "LR" | "TB" = "LR",
): LayoutNode[] {
  if (nodes.length === 0) return [];

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 80,
    ranksep: 120,
    marginx: 40,
    marginy: 40,
  });

  // Add nodes to dagre graph
  for (const node of nodes) {
    g.setNode(node.id, {
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
    });
  }

  // Add edges to dagre graph
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  // Run the layout algorithm
  dagre.layout(g);

  // Extract positions from dagre graph and return as LayoutNode[]
  const layoutNodes: LayoutNode[] = [];
  for (const node of nodes) {
    const dagreNode = g.node(node.id);
    if (!dagreNode) {
      // Fallback: node not in graph (shouldn't happen), assign default position
      layoutNodes.push({
        ...node,
        x: 0,
        y: 0,
        nodeWidth: DEFAULT_NODE_WIDTH,
        nodeHeight: DEFAULT_NODE_HEIGHT,
      });
      continue;
    }

    layoutNodes.push({
      ...node,
      x: dagreNode.x,
      y: dagreNode.y,
      nodeWidth: dagreNode.width ?? DEFAULT_NODE_WIDTH,
      nodeHeight: dagreNode.height ?? DEFAULT_NODE_HEIGHT,
    });
  }

  return layoutNodes;
}
