import { describe, expect, test } from "bun:test";
import {
  createProductionPiAdapter,
  createProductionQueryFn,
  type ProductionPiBindings,
} from "../src/index.js";

describe("productionQueryFn Pi adapter", () => {
  test("installs system guidance in the loader and prompts once with sole user content", async () => {
    const loaderSystemPrompts: string[] = [];
    const promptedContent: string[] = [];
    const model = { provider: "test", id: "test-model" };
    class FakeDefaultResourceLoader {
      constructor(options: { systemPrompt: string }) {
        loaderSystemPrompts.push(options.systemPrompt);
      }

      async reload() {}
    }
    const session = {
      bindExtensions: async (_extensions: Record<string, never>) => {},
      modelRegistry: { find: () => model },
      setModel: async (_model: unknown) => {},
      subscribe: () => () => {},
      prompt: async (content: string) => {
        promptedContent.push(content);
      },
      messages: [
        {
          role: "assistant" as const,
          content: [{ type: "text", text: "adapter response" }],
          provider: "test",
          model: "test-model",
          stopReason: "stop",
          usage: {},
        },
      ],
    };
    const piBindings: ProductionPiBindings = {
      cwd: "/test",
      agentDir: "/test/.pi",
      provider: "test",
      modelId: "test-model",
      createDefaultResourceLoader(options) {
        return new FakeDefaultResourceLoader(options);
      },
      async createAgentSession() {
        return { session };
      },
    };
    const query = createProductionQueryFn(async () =>
      createProductionPiAdapter(piBindings),
    );

    const result = await query({
      system: "stable observer rails",
      messages: [{ role: "user", content: "sole observer task and context" }],
    });

    expect(result).toEqual({ content: "adapter response" });
    expect(loaderSystemPrompts).toEqual(["stable observer rails"]);
    expect(promptedContent).toEqual(["sole observer task and context"]);
  });
});
