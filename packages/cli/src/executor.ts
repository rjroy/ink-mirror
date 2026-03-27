import type { OperationDefinition } from "@ink-mirror/shared";
import type { DaemonClient } from "./client.js";

/**
 * Executes a resolved operation against the daemon.
 * Builds the request from the operation definition and CLI args.
 */
export async function executeOperation(
  client: DaemonClient,
  operation: OperationDefinition,
  args: string[],
): Promise<void> {
  const { method, path } = operation.invocation;

  // Build request body from positional args matched to parameters
  let body: Record<string, string> | undefined;
  if (operation.parameters?.length && args.length > 0) {
    body = {};
    for (let i = 0; i < operation.parameters.length && i < args.length; i++) {
      body[operation.parameters[i].name] = args[i];
    }
  }

  const init: RequestInit = { method };
  if (body && (method === "POST" || method === "PATCH" || method === "PUT")) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }

  const response = await client.fetch(path, init);
  const text = await response.text();

  if (!response.ok) {
    console.error(`Error (${response.status}): ${text}`);
    process.exit(1);
  }

  // Try to pretty-print JSON, fall back to raw text
  try {
    const json = JSON.parse(text);
    console.log(JSON.stringify(json, null, 2));
  } catch {
    if (text.trim()) console.log(text);
  }
}
