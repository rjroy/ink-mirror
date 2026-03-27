import type { HelpTreeNode, OperationDefinition } from "@ink-mirror/shared";
import type { DaemonClient } from "./client.js";

/**
 * Formats a help tree node for terminal display.
 */
export function formatHelpTree(node: HelpTreeNode, indent: number = 0): string {
  const lines: string[] = [];
  const prefix = "  ".repeat(indent);

  if (indent === 0) {
    lines.push(`${node.name}`);
    if (node.description) lines.push(`  ${node.description}`);
    lines.push("");
  }

  if (node.operations?.length) {
    for (const op of node.operations) {
      lines.push(
        `${prefix}  ${op.name}  ${op.description}  [${op.invocation.method} ${op.invocation.path}]`,
      );
    }
  }

  if (node.children) {
    for (const [key, child] of Object.entries(node.children)) {
      lines.push(`${prefix}${key}`);
      if (child.description) lines.push(`${prefix}  ${child.description}`);
      lines.push(formatHelpTree(child, indent + 1));
    }
  }

  return lines.join("\n");
}

/**
 * Resolves CLI arguments against the help tree to find a target operation
 * or subtree for help display.
 */
export interface ResolvedCommand {
  type: "help";
  tree: HelpTreeNode;
}

export interface ResolvedOperation {
  type: "operation";
  operation: OperationDefinition;
  args: string[];
}

export type Resolution = ResolvedCommand | ResolvedOperation;

export async function resolveCommand(
  client: DaemonClient,
  args: string[],
): Promise<Resolution> {
  // No args or "help" as first arg: show full tree
  if (args.length === 0 || args[0] === "help") {
    const pathSegments = args[0] === "help" ? args.slice(1) : [];
    const tree = await client.getHelpTree(
      pathSegments.length ? pathSegments : undefined,
    );
    return { type: "help", tree };
  }

  // Check if the last arg is "help": show subtree
  if (args[args.length - 1] === "help") {
    const pathSegments = args.slice(0, -1);
    const tree = await client.getHelpTree(pathSegments);
    return { type: "help", tree };
  }

  // Try to find an operation by walking the tree
  const tree = await client.getHelpTree();
  let current: HelpTreeNode = tree;

  for (let i = 0; i < args.length; i++) {
    const segment = args[i];

    // Check if this segment resolves to an operation at the current level
    if (current.operations) {
      const op = current.operations.find((o) => o.name === segment);
      if (op) {
        return { type: "operation", operation: op, args: args.slice(i + 1) };
      }
    }

    // Check if it's a subtree
    if (current.children?.[segment]) {
      current = current.children[segment];

      // If this node has exactly one operation and there are remaining args,
      // those args are for the operation (e.g., "entries create body-text")
      if (current.operations?.length === 1 && i + 1 < args.length) {
        return {
          type: "operation",
          operation: current.operations[0],
          args: args.slice(i + 1),
        };
      }
      continue;
    }

    // Can't resolve further: show help for where we got to
    return { type: "help", tree: current };
  }

  // Exhausted args, check if we landed on a node with operations
  if (current.operations?.length === 1) {
    return { type: "operation", operation: current.operations[0], args: [] };
  }

  return { type: "help", tree: current };
}
