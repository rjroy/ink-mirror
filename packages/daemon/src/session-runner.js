/**
 * Session runner: single entry point for all LLM interaction (REQ-V1-27).
 *
 * Callers describe what they need (system prompt, user messages).
 * The runner manages the SDK call, error recovery, and response parsing.
 * The queryFn is injectable for testing.
 */
export function createSessionRunner(deps) {
    const { queryFn, maxRetries = 2 } = deps;
    return {
        async run(request) {
            let lastError;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    return await queryFn(request);
                }
                catch (err) {
                    lastError = err;
                    // Retry on transient errors, bail on everything else
                    if (isTransient(err) && attempt < maxRetries) {
                        continue;
                    }
                    throw err;
                }
            }
            throw lastError;
        },
    };
}
function isTransient(err) {
    if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        return (msg.includes("overloaded") ||
            msg.includes("rate limit") ||
            msg.includes("timeout") ||
            msg.includes("529") ||
            msg.includes("500"));
    }
    return false;
}
