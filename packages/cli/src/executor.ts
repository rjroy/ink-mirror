import type { OperationDefinition, OperationParameter } from "@ink-mirror/shared";
import type { DaemonClient } from "./client.js";

type CoercedValue = string | number | boolean;

/**
 * Coerces a raw positional arg to the parameter's declared type.
 * Returns { skip: true } to signal the arg should be omitted (empty optional).
 * Returns { error } on invalid input (e.g., "maybe" for a boolean).
 */
function coerceArg(
  raw: string,
  param: OperationParameter,
): { value: CoercedValue } | { skip: true } | { error: string } {
  if (raw === "" && !param.required) {
    return { skip: true };
  }

  switch (param.type) {
    case "boolean": {
      const lower = raw.toLowerCase();
      if (lower === "true") return { value: true };
      if (lower === "false") return { value: false };
      return {
        error: `Invalid value for ${param.name}: expected "true" or "false", got "${raw}"`,
      };
    }
    case "number": {
      const n = Number(raw);
      if (Number.isNaN(n)) {
        return { error: `Invalid value for ${param.name}: expected a number, got "${raw}"` };
      }
      return { value: n };
    }
    case "string":
    default:
      return { value: raw };
  }
}

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
  let body: Record<string, CoercedValue> | undefined;
  const params = operation.parameters ?? [];
  const argsCopy = [...args];

  // Substitute path parameters (e.g., /entries/:id) from args
  for (const param of params) {
    const placeholder = `:${param.name}`;
    if (path.includes(placeholder) && argsCopy.length > 0) {
      path = path.replace(placeholder, encodeURIComponent(argsCopy.shift()!));
    }
  }

  // Remaining args become body (for write methods) or query params (for read methods)
  const remainingParams = params.filter(
    (p) => !operation.invocation.path.includes(`:${p.name}`),
  );

  if (argsCopy.length > 0 && remainingParams.length > 0) {
    if (method === "GET" || method === "DELETE") {
      // For read methods, remaining args become query parameters
      const query = new URLSearchParams();
      for (let i = 0; i < remainingParams.length && i < argsCopy.length; i++) {
        const param = remainingParams[i];
        const result = coerceArg(argsCopy[i], param);
        if ("error" in result) {
          console.error(`Error: ${result.error}`);
          process.exit(1);
        }
        if ("skip" in result) continue;
        query.set(param.name, String(result.value));
      }
      const qs = query.toString();
      if (qs) path += `?${qs}`;
    } else {
      // For write methods, remaining args become the JSON body
      const collected: Record<string, CoercedValue> = {};
      for (let i = 0; i < remainingParams.length && i < argsCopy.length; i++) {
        const param = remainingParams[i];
        const result = coerceArg(argsCopy[i], param);
        if ("error" in result) {
          console.error(`Error: ${result.error}`);
          process.exit(1);
        }
        if ("skip" in result) continue;
        collected[param.name] = result.value;
      }
      if (Object.keys(collected).length > 0) body = collected;
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
    const json: unknown = JSON.parse(text);
    console.log(JSON.stringify(json, null, 2));
  } catch {
    if (text.trim()) console.log(text);
  }
}
