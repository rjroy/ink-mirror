#!/usr/bin/env bun
import { createDaemonClient } from "./client.js";
import { resolveCommand, formatHelpTree } from "./discovery.js";
import { executeOperation } from "./executor.js";
import { writeEntry } from "./write.js";

const SOCKET_PATH =
  process.env.INK_MIRROR_SOCKET ?? "/tmp/ink-mirror.sock";

async function main(): Promise<void> {
  const client = createDaemonClient(SOCKET_PATH);
  const args = process.argv.slice(2);

  // "write" is a CLI-specific command that opens $EDITOR
  if (args[0] === "write") {
    await writeEntry(client);
    return;
  }

  const resolution = await resolveCommand(client, args);

  if (resolution.type === "help") {
    console.log(formatHelpTree(resolution.tree));
    return;
  }

  await executeOperation(client, resolution.operation, resolution.args);
}

main().catch((err: Error) => {
  if (err.message.includes("ECONNREFUSED") || err.message.includes("ENOENT")) {
    console.error(
      "Cannot connect to ink-mirror daemon. Is it running?",
    );
    console.error(`  Expected socket at: ${SOCKET_PATH}`);
    process.exit(1);
  }
  console.error(err.message);
  process.exit(1);
});
