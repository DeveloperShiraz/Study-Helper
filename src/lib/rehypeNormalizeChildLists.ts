import type { Root } from 'hast';

type HastLike = {
  children?: unknown;
};

function normalizeChildListsDeep(node: unknown): void {
  if (!node || typeof node !== 'object') {
    return;
  }
  const hastNode = node as HastLike;
  const kids = hastNode.children;
  if (!Array.isArray(kids)) {
    return;
  }
  const cleaned = kids.filter((child) => child != null);
  if (cleaned.length !== kids.length) {
    hastNode.children = cleaned;
  }
  for (const child of cleaned) {
    normalizeChildListsDeep(child);
  }
}

/**
 * Removes null/undefined slots from every `children` array in the HAST tree so tree walkers
 * (`unist-util-visit` / `unist-util-visit-parents`, including react-markdown’s `post` pass) never
 * see `undefined` nodes (`'children' in undefined`).
 */
export function rehypeNormalizeChildLists() {
  return (tree: Root) => {
    normalizeChildListsDeep(tree);
  };
}
