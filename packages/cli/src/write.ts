import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
import type { DaemonClient } from "./client.js";

/**
 * Opens $EDITOR with a temp file, then submits the content to the daemon.
 * This is the primary journal writing flow (REQ-V1-25).
 */
export async function writeEntry(
  client: DaemonClient,
  editorSpawn?: (file: string) => Promise<number>,
): Promise<void> {
  const editor = process.env.EDITOR;
  if (!editor) {
    console.error(
      "No $EDITOR set. Set EDITOR to your preferred text editor.",
    );
    process.exit(1);
  }

  const tmpFile = join(
    tmpdir(),
    `ink-mirror-${Date.now()}.md`,
  );

  // Create an empty temp file for the editor
  writeFileSync(tmpFile, "", "utf-8");

  try {
    const exitCode = await (editorSpawn ?? defaultSpawn)(tmpFile);
    if (exitCode !== 0) {
      console.error(`Editor exited with code ${exitCode}. Entry not saved.`);
      process.exit(1);
    }

    const content = readFileSync(tmpFile, "utf-8").trim();
    if (!content) {
      console.log("Empty entry, nothing saved.");
      return;
    }

    const res = await client.fetch("/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: content }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Error saving entry: ${text}`);
      process.exit(1);
    }

    const entry = await res.json();
    console.log(`Entry saved: ${entry.id}`);
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      // Best effort cleanup
    }
  }
}

async function defaultSpawn(file: string): Promise<number> {
  const editor = process.env.EDITOR!;
  const proc = Bun.spawn([editor, file], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return proc.exited;
}
