/**
 * Session runner: single entry point for all LLM interaction (REQ-V1-27).
 *
 * Callers describe what they need (system prompt, user messages).
 * The runner manages the SDK call, error recovery, and response parsing.
 * The queryFn is injectable for testing.
 */
export interface SessionMessage {
    role: "user" | "assistant";
    content: string;
}
export interface SessionRequest {
    system: string;
    messages: SessionMessage[];
    maxTokens?: number;
}
export interface SessionResponse {
    content: string;
}
/**
 * The function that actually calls the LLM.
 * Production uses the Anthropic SDK; tests provide a mock.
 */
export type QueryFn = (request: SessionRequest) => Promise<SessionResponse>;
export interface SessionRunnerDeps {
    queryFn: QueryFn;
    maxRetries?: number;
}
export interface SessionRunner {
    run(request: SessionRequest): Promise<SessionResponse>;
}
export declare function createSessionRunner(deps: SessionRunnerDeps): SessionRunner;
//# sourceMappingURL=session-runner.d.ts.map