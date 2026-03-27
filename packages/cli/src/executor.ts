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
  const { method } = operation.invocation;
  let { path } = operation.invocation;

  // Build request body from positional args matched to parameters.
  // For GET/DELETE, path params (e.g., :id) are substituted from args.
  // For POST/PUT/PATCH, args become the JSON body.
  let body: Record<string, string> | undefined;
  const params = operation.parameters ?? [];
  const argsCopy = [...args];

  // Substitute path parameters (e.g., /entries/:id) from args
  for (const param of params) {
    const placeholder = `:${param.name}`;
    if (path.includes(placeholder) && argsCopy.length > 0) {
      path = path.replace(placeholder, encodeURIComponent(argsCopy.shift()!));
    }
  }

  // Remaining args become the body for write methods
  if (argsCopy.length > 0 && params.length > 0) {
    body = {};
    const remainingParams = params.filter(
      (p) => !operation.invocation.path.includes(`:${p.name}`),
    );
    for (let i = 0; i < remainingParams.length && i < argsCopy.length; i++) {
      body[remainingParams[i].name] = argsCopy[i];
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
