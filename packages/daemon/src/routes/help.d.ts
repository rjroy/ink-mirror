import type { OperationsRegistry } from "../registry.js";
import type { RouteModule } from "../types.js";
interface HelpDeps {
    registry: OperationsRegistry;
}
/**
 * Help routes expose the operations registry for CLI discovery.
 *
 * GET /help          - Full tree
 * GET /help/:path+   - Subtree at path (e.g., /help/entries/list)
 */
export declare function createHelpRoutes(deps: HelpDeps): RouteModule;
export {};
//# sourceMappingURL=help.d.ts.map