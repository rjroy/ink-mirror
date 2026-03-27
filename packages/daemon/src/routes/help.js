import { Hono } from "hono";
/**
 * Help routes expose the operations registry for CLI discovery.
 *
 * GET /help          - Full tree
 * GET /help/:path+   - Subtree at path (e.g., /help/entries/list)
 */
export function createHelpRoutes(deps) {
    const app = new Hono();
    app.get("/", (c) => {
        return c.json(deps.registry.getTree());
    });
    app.get("/:path{.+}", (c) => {
        const pathStr = c.req.param("path");
        const segments = pathStr.split("/").filter(Boolean);
        const node = deps.registry.findByPath(segments);
        if (!node) {
            return c.json({ error: `No operations found at path: ${segments.join("/")}` }, 404);
        }
        return c.json(node);
    });
    return {
        routes: app,
        // Help routes don't register operations themselves
        operations: [],
    };
}
