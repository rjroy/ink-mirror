import type { OperationDefinition, HelpTreeNode } from "@ink-mirror/shared";

/**
 * The operations registry collects OperationDefinition objects from
 * route modules and builds a navigable help tree for CLI discovery.
 *
 * Tree structure: root → feature → operations
 * Example: "entries" → "list" → { GET /entries }
 */
export interface OperationsRegistry {
  register(operations: OperationDefinition[]): void;
  getAll(): OperationDefinition[];
  getTree(): HelpTreeNode;
  findByPath(segments: string[]): HelpTreeNode | undefined;
}

export function createOperationsRegistry(): OperationsRegistry {
  const allOperations: OperationDefinition[] = [];

  function buildTree(operations: OperationDefinition[]): HelpTreeNode {
    const root: HelpTreeNode = { name: "ink-mirror" };

    for (const op of operations) {
      const { root: rootName, feature } = op.hierarchy;

      if (!root.children) root.children = {};
      if (!root.children[rootName]) {
        root.children[rootName] = { name: rootName };
      }

      const rootNode = root.children[rootName];
      if (!rootNode.children) rootNode.children = {};
      if (!rootNode.children[feature]) {
        rootNode.children[feature] = { name: feature };
      }

      const featureNode = rootNode.children[feature];
      if (!featureNode.operations) featureNode.operations = [];
      featureNode.operations.push(op);
    }

    return root;
  }

  return {
    register(operations: OperationDefinition[]): void {
      allOperations.push(...operations);
    },

    getAll(): OperationDefinition[] {
      return [...allOperations];
    },

    getTree(): HelpTreeNode {
      return buildTree(allOperations);
    },

    findByPath(segments: string[]): HelpTreeNode | undefined {
      const tree = buildTree(allOperations);
      let current: HelpTreeNode | undefined = tree;
      for (const segment of segments) {
        current = current?.children?.[segment];
        if (!current) return undefined;
      }
      return current;
    },
  };
}
