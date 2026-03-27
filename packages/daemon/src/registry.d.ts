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
export declare function createOperationsRegistry(): OperationsRegistry;
//# sourceMappingURL=registry.d.ts.map