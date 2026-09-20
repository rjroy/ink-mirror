import {
  AuthStorage,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  createAgentSession,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";

const provider = "ollama";
const modelId = "qwen3.6:27b";
const cwd = process.cwd();
const agentDir = getAgentDir();
const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);
const settingsManager = SettingsManager.create(cwd, agentDir);

const prompt = `Make these three simple decisions:
1. Is 2 greater than 1?
2. Which is longer: "cat" or "elephant"?
3. Should a red traffic light mean stop?

Return exactly one JSON object with boolean properties "twoGreaterThanOne", "elephantIsLonger", and "redMeansStop". Do not include markdown, prose, or code fences.`;

async function run(): Promise<void> {
  const loader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    noContextFiles: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noExtensions: true,
  });
  await loader.reload();

  const { session, modelFallbackMessage } = await createAgentSession({
    cwd,
    agentDir,
    authStorage,
    modelRegistry,
    settingsManager,
    resourceLoader: loader,
    sessionManager: SessionManager.inMemory(cwd),
    noTools: "all",
  });
  if (modelFallbackMessage) console.warn(`[ollama-smoke] ${modelFallbackMessage}`);

  await session.bindExtensions({});
  const model = session.modelRegistry.find(provider, modelId);
  if (!model) {
    throw new Error(
      `Model ${provider}/${modelId} was not found. Verify the local Ollama provider is configured for Pi and that the model is installed.`,
    );
  }
  await session.setModel(model);
  await session.prompt(prompt);

  const lastAssistant = [...session.messages]
    .reverse()
    .find((message) => message.role === "assistant");
  if (!lastAssistant || lastAssistant.role !== "assistant") {
    throw new Error("The model completed without an assistant response.");
  }

  const raw = lastAssistant.content
    .filter((content): content is { type: "text"; text: string } => content.type === "text")
    .map((content) => content.text)
    .join("");
  console.log("Raw model response:");
  console.log(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Model response was not valid JSON. Ask the model to return only a JSON object, then retry. JSON.parse: ${detail}`,
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Model response parsed successfully but was not a JSON object.");
  }

  console.log("Parsed JSON object:");
  console.log(JSON.stringify(parsed, null, 2));
}

run().catch((error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[ollama-smoke] FAILED: ${detail}`);
  process.exitCode = 1;
});
