import type { ProfileStore } from "../profile-store.js";
import type { RouteModule } from "../types.js";
export interface ProfileDeps {
    profileStore: ProfileStore;
}
/**
 * Profile routes: read, edit rules, full profile replace.
 *
 * GET    /profile           - Read current profile (markdown + structured)
 * PATCH  /profile/rules/:id - Edit a single rule
 * DELETE /profile/rules/:id - Remove a rule
 * PUT    /profile           - Full profile replace from markdown
 */
export declare function createProfileRoutes(deps: ProfileDeps): RouteModule;
//# sourceMappingURL=profile.d.ts.map