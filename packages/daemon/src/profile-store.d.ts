import type { Profile, ProfileRule, ObservationDimension } from "@ink-mirror/shared";
/**
 * Filesystem operations needed by ProfileStore.
 * Same DI pattern as EntryStore and ObservationStore.
 */
export interface ProfileStoreFs {
    readFile(path: string, encoding: "utf-8"): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    mkdir(path: string, opts: {
        recursive: true;
    }): Promise<void>;
}
export interface ProfileStore {
    get(): Promise<Profile>;
    save(profile: Profile): Promise<void>;
    getRule(ruleId: string): Promise<ProfileRule | undefined>;
    updateRule(ruleId: string, updates: {
        pattern?: string;
        dimension?: ObservationDimension;
    }): Promise<ProfileRule | undefined>;
    deleteRule(ruleId: string): Promise<boolean>;
    addOrMergeRule(pattern: string, dimension: ObservationDimension): Promise<ProfileRule>;
    /** Render the profile as AI system prompt material (REQ-V1-23) */
    toPromptMarkdown(): Promise<string>;
    /** Replace the full profile from raw markdown (for PUT /profile) */
    replaceFromMarkdown(markdown: string): Promise<Profile>;
}
export interface ProfileStoreDeps {
    profilePath: string;
    fs?: ProfileStoreFs;
    now?: () => string;
}
/**
 * Serialize a profile to markdown with YAML frontmatter.
 * Structured by dimension so both humans and LLMs can parse it.
 */
export declare function profileToMarkdown(profile: Profile): string;
/**
 * Parse a profile markdown file back into a Profile object.
 * Handles both the structured format we generate and hand-edited versions.
 */
export declare function profileFromMarkdown(content: string): Profile | undefined;
/**
 * Checks if two patterns likely describe the same writing characteristic.
 * Extracts a "core" by removing filler words and modifiers, then checks
 * if the cores overlap significantly (60%+ word overlap).
 */
export declare function patternsMatch(a: string, b: string): boolean;
export declare function createProfileStore(deps: ProfileStoreDeps): ProfileStore;
/**
 * Transform an observation pattern into a stable characteristic.
 * Strips temporal references and entry-specific language.
 * Generalizes from instance ("used X in this entry") to characteristic ("uses X").
 */
export declare function transformToStablePattern(pattern: string): string;
//# sourceMappingURL=profile-store.d.ts.map