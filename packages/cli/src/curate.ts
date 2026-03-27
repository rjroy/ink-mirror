import type { DaemonClient } from "./client.js";
import type {
  CurationSession,
  ObservationWithContext,
  Contradiction,
} from "@ink-mirror/shared";

type ReadLineFn = (prompt: string) => Promise<string>;

/**
 * Creates a line reader over a single stdin stream.
 * Buffers input and splits on newline boundaries to avoid
 * the chunked-read problem where one read() could return
 * multiple lines or partial lines depending on OS buffering.
 */
function createStdinLineReader(): ReadLineFn {
  const decoder = new TextDecoder();
  const reader = Bun.stdin.stream().getReader();
  let buffer = "";

  return async (prompt: string): Promise<string> => {
    process.stdout.write(prompt);

    while (!buffer.includes("\n")) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }

    const newlineIdx = buffer.indexOf("\n");
    if (newlineIdx === -1) {
      // EOF with no newline, return whatever we have
      const line = buffer.trim();
      buffer = "";
      return line;
    }

    const line = buffer.slice(0, newlineIdx).trim();
    buffer = buffer.slice(newlineIdx + 1);
    return line;
  };
}

function formatObservation(obs: ObservationWithContext, index: number, total: number): string {
  const lines: string[] = [];
  lines.push(`--- Observation ${index + 1}/${total} [${obs.dimension}] ---`);
  lines.push("");
  lines.push(`Pattern: ${obs.pattern}`);
  lines.push(`Evidence: "${obs.evidence}"`);
  lines.push("");
  lines.push("Entry context:");
  // Show a preview of the entry text (first 200 chars)
  const preview = obs.entryText.length > 200
    ? obs.entryText.slice(0, 200) + "..."
    : obs.entryText;
  lines.push(`  ${preview}`);
  lines.push("");
  return lines.join("\n");
}

function formatContradiction(c: Contradiction): string {
  const lines: string[] = [];
  lines.push("=== Contradiction Detected ===");
  lines.push(`Dimension: ${c.dimension}`);
  lines.push("");
  lines.push(`New observation: ${c.newObservation.pattern}`);
  lines.push(`  Evidence: "${c.newObservation.evidence}"`);
  lines.push("");
  lines.push(`Conflicts with confirmed: ${c.confirmedObservation.pattern}`);
  lines.push(`  Evidence: "${c.confirmedObservation.evidence}"`);
  lines.push("");
  lines.push("Both may be intentional, or one may be drift.");
  lines.push("You'll classify the new observation below.");
  lines.push("");
  return lines.join("\n");
}

const VALID_INPUTS: Record<string, string> = {
  i: "intentional",
  intentional: "intentional",
  a: "accidental",
  accidental: "accidental",
  u: "undecided",
  undecided: "undecided",
  s: "skip",
  skip: "skip",
};

/**
 * Interactive curation session. Presents pending observations one at a time,
 * prompts for classification.
 */
export async function curateObservations(
  client: DaemonClient,
  readLineFn?: ReadLineFn,
): Promise<void> {
  const readline = readLineFn ?? createStdinLineReader();
  const session = await client.fetchJson<CurationSession>("/observations/pending");

  if (session.observations.length === 0) {
    console.log("No observations pending curation.");
    return;
  }

  console.log(
    `${session.observations.length} observation(s) to review.`,
  );
  console.log("");

  // Show contradictions upfront so the user has context
  if (session.contradictions.length > 0) {
    for (const c of session.contradictions) {
      console.log(formatContradiction(c));
    }
  }

  let classified = 0;
  let skipped = 0;

  for (let i = 0; i < session.observations.length; i++) {
    const obs = session.observations[i];
    console.log(formatObservation(obs, i, session.observations.length));

    let status: string | undefined;
    while (!status) {
      const input = await readline(
        "Classify: (i)ntentional / (a)ccidental / (u)ndecided / (s)kip > ",
      );
      const mapped = VALID_INPUTS[input.toLowerCase()];
      if (!mapped) {
        console.log("Invalid input. Use: i, a, u, or s");
        continue;
      }
      status = mapped;
    }

    if (status === "skip") {
      skipped++;
      continue;
    }

    const res = await client.fetch(`/observations/${obs.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Failed to classify ${obs.id}: ${text}`);
    } else {
      classified++;
    }
  }

  console.log("");
  console.log(
    `Done. ${classified} classified, ${skipped} skipped.`,
  );
}
