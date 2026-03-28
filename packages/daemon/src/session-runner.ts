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

export function createSessionRunner(deps: SessionRunnerDeps): SessionRunner {
  const { queryFn, maxRetries = 2 } = deps;

  return {
    async run(request: SessionRequest): Promise<SessionResponse> {
      let lastError: unknown;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`[session] retry ${attempt}/${maxRetries}`);
          }
          return await queryFn(request);
        } catch (err) {
          lastError = err;
          const message = err instanceof Error ? err.message : String(err);
          // Retry on transient errors, bail on everything else
          if (isTransient(err) && attempt < maxRetries) {
            console.warn(`[session] transient error (attempt ${attempt + 1}/${maxRetries + 1}): ${message}`);
            continue;
          }
          console.error(`[session] fatal error: ${message}`);
          throw err;
        }
      }

      throw lastError;
    },
  };
}

function isTransient(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("overloaded") ||
      msg.includes("rate limit") ||
      msg.includes("timeout") ||
      msg.includes("529") ||
      msg.includes("500")
    );
  }
  return false;
}
