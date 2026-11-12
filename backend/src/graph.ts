// A dependency edge: task `from` depends on task `to`.
export type Edge = {
  from: number;
  to: number;
};

// Depth-first search from `start`, following dependency edges.
// Returns the path [start, ..., target] if `target` can be reached, otherwise null.
export function findPath(edges: Edge[], start: number, target: number): number[] | null {
  const next = new Map<number, number[]>();
  for (const { from, to } of edges) {
    const list = next.get(from) ?? [];
    list.push(to);
    next.set(from, list);
  }

  const visited = new Set<number>();
  const path: number[] = [];

  function visit(node: number): boolean {
    path.push(node);
    if (node === target) {
      return true;
    }
    visited.add(node);

    for (const neighbour of next.get(node) ?? []) {
      if (!visited.has(neighbour) && visit(neighbour)) {
        return true;
      }
    }

    path.pop();
    return false;
  }

  return visit(start) ? path : null;
}