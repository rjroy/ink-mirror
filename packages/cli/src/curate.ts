import type { DaemonClient } from "./client.js";
import type {
  Dossier,
  Pattern,
  PatternContradiction,
  PatternCurationSession,
  PatternProposal,
  ResurfacedRule,
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

/**
 * Renders one dossier in the research-grounded presentation order (Phase 4/6
 * plan): evidence first, counts second, trend third, watch-status last.
 * Every number here comes straight off the API response (REQ-LPC-8) — this
 * function only formats, it never computes.
 */
function formatDossier(dossier: Dossier, index: number, total: number, headerLabel = "Pattern"): string {
  const { pattern, sightings, distinctEntryCount, trend, watchStatus } = dossier;
  const lines: string[] = [];

  lines.push(`--- ${headerLabel} ${index + 1}/${total} [${pattern.dimension}] (${pattern.status}) ${pattern.id} ---`);
  lines.push("");
  lines.push(`Statement: ${pattern.statement}`);
  lines.push("");

  if (pattern.migratedNoHistory) {
    lines.push("Migrated, no historical sightings recorded.");
  } else if (sightings.length === 0) {
    lines.push("No sightings recorded yet.");
  } else {
    const entryWord = distinctEntryCount === 1 ? "entry" : "entries";
    lines.push(`Evidence (${sightings.length} sighting(s) across ${distinctEntryCount} distinct ${entryWord}):`);
    sightings.forEach((s, i) => {
      lines.push(`  [${i + 1}] entry ${s.entryId}: "${s.evidence}"`);
      lines.push(`      context: ${s.entryText}`);
    });
  }
  lines.push("");

  if (trend) {
    const baselineText = trend.baseline !== undefined ? `, baseline ${trend.baseline}` : "";
    lines.push(
      `Trend (${trend.metricLink}): rolling mean ${trend.rollingMean} over last ${trend.windowSize} entries${baselineText}.`,
    );
    lines.push("");
  }

  if (watchStatus) {
    const resolvedText = watchStatus.resolved ? ` (resolved ${watchStatus.resolvedAt})` : "";
    lines.push(`Watch status (accidental since ${watchStatus.classifiedAt}): ${watchStatus.recurrenceText}${resolvedText}`);
    lines.push("");
  }

  return lines.join("\n");
}

function formatContradiction(c: PatternContradiction): string {
  const lines: string[] = [];
  lines.push("=== Contradiction Detected ===");
  lines.push(`Dimension: ${c.dimension}`);
  lines.push("");
  lines.push(`Unclassified: ${c.pattern.statement} [${c.pattern.id}]`);
  lines.push(`Conflicts with confirmed: ${c.contradicts.statement} [${c.contradicts.id}]`);
  lines.push("");
  lines.push("Both may be intentional, or one may be drift.");
  lines.push("You'll classify the unclassified pattern below.");
  lines.push("");
  return lines.join("\n");
}

function formatResurfacedRule(item: ResurfacedRule): string {
  const lines: string[] = [];
  lines.push(`=== Rule resurfaced: ${item.reasons.join(", ")} ===`);
  lines.push(`Rule: ${item.rule.pattern} [${item.rule.id}]`);
  if (item.staleness) {
    lines.push(`  No sighting in the last ${item.staleness.windowSize} entries.`);
  }
  if (item.drift) {
    const deviationPct = (item.drift.relativeDeviation * 100).toFixed(0);
    const marginPct = (item.drift.margin * 100).toFixed(0);
    lines.push(
      `  Rolling mean ${item.drift.rollingMean} vs baseline ${item.drift.baseline} (${deviationPct}% deviation, margin ${marginPct}%).`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function formatProposal(p: PatternProposal): string {
  return [
    "=== Promotion proposal ===",
    `Pattern: ${p.statement} [${p.patternId}]`,
    `${p.sightingCount} sighting(s) across ${p.distinctEntryCount} entries, ${p.totalWordCount} words total.`,
    "",
  ].join("\n");
}

/** POSTs an action, tolerating an empty body, and logs (without throwing) on failure. */
async function postAction(client: DaemonClient, path: string, body?: unknown): Promise<boolean> {
  const res = await client.fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed (${path}): ${text}`);
    return false;
  }
  return true;
}

const CLASSIFY_INPUTS: Record<string, "intentional" | "accidental" | "undecided"> = {
  i: "intentional",
  intentional: "intentional",
  a: "accidental",
  accidental: "accidental",
  u: "undecided",
  undecided: "undecided",
};

type DossierOutcome = "classified" | "skipped" | "dismissed" | "detached" | "merged" | "failed";

async function classifyPattern(
  client: DaemonClient,
  patternId: string,
  status: "intentional" | "accidental" | "undecided",
  readline: ReadLineFn,
): Promise<boolean> {
  let promote = false;
  if (status === "intentional") {
    // Classify-and-promote in one action (REQ-LPC-16): the writer's judgment
    // is the asymmetric evidence standard, so promotion never waits on
    // thresholds here.
    const answer = (await readline("Promote to a profile rule now? (y/N) > ")).toLowerCase();
    promote = answer === "y" || answer === "yes";
  }
  return postAction(client, `/patterns/${patternId}/classify`, { status, promote });
}

async function handleDossier(
  client: DaemonClient,
  dossier: Dossier,
  index: number,
  total: number,
  readline: ReadLineFn,
): Promise<DossierOutcome> {
  console.log(formatDossier(dossier, index, total));

  const prompt =
    "Action: (i)ntentional / (a)ccidental / (u)ndecided / (s)kip / (d)ismiss / de(t)ach / (m)erge > ";

  while (true) {
    const raw = (await readline(prompt)).toLowerCase();

    if (raw in CLASSIFY_INPUTS) {
      const ok = await classifyPattern(client, dossier.pattern.id, CLASSIFY_INPUTS[raw], readline);
      return ok ? "classified" : "failed";
    }

    if (raw === "s" || raw === "skip") {
      return "skipped";
    }

    if (raw === "d" || raw === "dismiss") {
      const ok = await postAction(client, `/patterns/${dossier.pattern.id}/dismiss`);
      return ok ? "dismissed" : "failed";
    }

    if (raw === "t" || raw === "detach") {
      if (dossier.sightings.length === 0) {
        console.log("No sightings to detach.");
        continue;
      }
      let idx = -1;
      while (true) {
        const idxRaw = await readline(`Detach which sighting? [1-${dossier.sightings.length}] > `);
        idx = Number(idxRaw) - 1;
        if (Number.isInteger(idx) && idx >= 0 && idx < dossier.sightings.length) break;
        console.log("Invalid sighting number.");
      }
      const ok = await postAction(client, `/patterns/${dossier.pattern.id}/detach`, {
        sightingId: dossier.sightings[idx].id,
      });
      return ok ? "detached" : "failed";
    }

    if (raw === "m" || raw === "merge") {
      const duplicateId = (await readline("Duplicate pattern ID to merge into this one > ")).trim();
      if (!duplicateId) {
        console.log("Merge cancelled: no ID given.");
        continue;
      }
      const ok = await postAction(client, `/patterns/${dossier.pattern.id}/merge`, { duplicateId });
      return ok ? "merged" : "failed";
    }

    console.log("Invalid input. Use i, a, u, s, d, t, or m.");
  }
}

async function handleResurfacedRules(
  rules: ResurfacedRule[],
  client: DaemonClient,
  readline: ReadLineFn,
): Promise<{ reaffirmed: number; retired: number }> {
  let reaffirmed = 0;
  let retired = 0;

  for (const item of rules) {
    console.log(formatResurfacedRule(item));
    while (true) {
      const raw = (await readline("(r)eaffirm / re(x)tire / (s)kip > ")).toLowerCase();
      if (raw === "r" || raw === "reaffirm") {
        if (await postAction(client, `/patterns/${item.pattern.id}/reaffirm`)) reaffirmed++;
        break;
      }
      if (raw === "x" || raw === "retire") {
        if (await postAction(client, `/patterns/${item.pattern.id}/retire`)) retired++;
        break;
      }
      if (raw === "s" || raw === "skip") break;
      console.log("Invalid input. Use r, x, or s");
    }
  }

  return { reaffirmed, retired };
}

async function handleProposals(
  proposals: PatternProposal[],
  client: DaemonClient,
  readline: ReadLineFn,
): Promise<{ accepted: number; declined: number }> {
  let accepted = 0;
  let declined = 0;

  for (const p of proposals) {
    console.log(formatProposal(p));
    while (true) {
      const raw = (await readline("(a)ccept / (d)ecline / (s)kip > ")).toLowerCase();
      if (raw === "a" || raw === "accept") {
        if (await postAction(client, `/patterns/${p.patternId}/proposal`, { action: "accept" })) accepted++;
        break;
      }
      if (raw === "d" || raw === "decline") {
        if (await postAction(client, `/patterns/${p.patternId}/proposal`, { action: "decline" })) declined++;
        break;
      }
      if (raw === "s" || raw === "skip") break;
      console.log("Invalid input. Use a, d, or s");
    }
  }

  return { accepted, declined };
}

/**
 * Watched (accidental) patterns don't appear in `session.dossiers` (that
 * list is candidate/undecided only), so this is the only place their full
 * evidence dossier ever surfaces. Read-only: watch resolution never mutates
 * classification (REQ-LPC-25), so there's no action to offer here.
 */
function printWatchList(watchList: Dossier[]): void {
  if (watchList.length === 0) return;
  console.log("=== Watch list ===");
  console.log("");
  watchList.forEach((dossier, i) => {
    console.log(formatDossier(dossier, i, watchList.length, "Watched pattern"));
  });
}

/**
 * REQ-LPC-26: below the promotion thresholds, curation must still be honest
 * rather than silent. An `intentional` pattern with no linked rule and no
 * current proposal is exactly that below-threshold state — it won't appear
 * anywhere else in the session (dossiers are candidate/undecided only,
 * proposals only exist once thresholds are crossed) — so this reports it
 * explicitly using the same deterministic counters as the rest of the
 * session (REQ-LPC-8).
 */
async function printAccumulatingEvidence(client: DaemonClient, proposals: PatternProposal[]): Promise<void> {
  const proposedIds = new Set(proposals.map((p) => p.patternId));

  let intentional: Pattern[];
  try {
    intentional = await client.fetchJson<Pattern[]>("/patterns?status=intentional");
  } catch (err) {
    console.error(`Could not check for below-threshold patterns: ${(err as Error).message}`);
    return;
  }

  const pending = intentional.filter((p) => !p.ruleId && !proposedIds.has(p.id));
  if (pending.length === 0) return;

  console.log("=== Evidence still accumulating ===");
  for (const p of pending) {
    const entryWord = p.entryIds.length === 1 ? "entry" : "entries";
    const sightingWord = p.sightingCount === 1 ? "sighting" : "sightings";
    console.log(
      `  "${p.statement}" [${p.id}]: ${p.sightingCount} ${sightingWord} across ${p.entryIds.length} distinct ${entryWord} — not yet eligible for a promotion proposal.`,
    );
  }
  console.log("");
}

/**
 * Interactive pattern-grain curation session (REQ-LPC-12/28). Presents, in
 * order: contradictions, resurfaced rules (reaffirm/retire), pending
 * promotion proposals (accept/decline), the accidental watch list
 * (read-only), then every candidate/undecided pattern's dossier
 * (classify/dismiss/detach/merge/skip). Ends by naming any `intentional`
 * pattern still short of the promotion thresholds (REQ-LPC-26).
 */
export async function curatePatterns(client: DaemonClient, readLineFn?: ReadLineFn): Promise<void> {
  const readline = readLineFn ?? createStdinLineReader();
  const session = await client.fetchJson<PatternCurationSession>("/patterns/session");
  const proposals = session.proposals ?? [];

  const nothingToReview =
    session.dossiers.length === 0 &&
    session.contradictions.length === 0 &&
    session.watchList.length === 0 &&
    session.resurfacedRules.length === 0 &&
    proposals.length === 0;

  if (nothingToReview) {
    console.log("No patterns pending curation.");
    await printAccumulatingEvidence(client, proposals);
    return;
  }

  for (const c of session.contradictions) {
    console.log(formatContradiction(c));
  }

  const ruleHealthResult = await handleResurfacedRules(session.resurfacedRules, client, readline);
  const proposalResult = await handleProposals(proposals, client, readline);
  printWatchList(session.watchList);

  let classified = 0;
  let skipped = 0;
  let dismissed = 0;
  let detached = 0;
  let merged = 0;

  for (let i = 0; i < session.dossiers.length; i++) {
    const outcome = await handleDossier(client, session.dossiers[i], i, session.dossiers.length, readline);
    switch (outcome) {
      case "classified":
        classified++;
        break;
      case "skipped":
        skipped++;
        break;
      case "dismissed":
        dismissed++;
        break;
      case "detached":
        detached++;
        break;
      case "merged":
        merged++;
        break;
      case "failed":
        // postAction already logged the daemon's error; don't miscount this
        // as any successful outcome.
        break;
    }
  }

  await printAccumulatingEvidence(client, proposals);

  const summary = [`${classified} classified, ${skipped} skipped, ${dismissed} dismissed, ${detached} detached, ${merged} merged`];
  if (session.resurfacedRules.length > 0) {
    summary.push(`${ruleHealthResult.reaffirmed} reaffirmed, ${ruleHealthResult.retired} retired`);
  }
  if (proposals.length > 0) {
    summary.push(`${proposalResult.accepted} proposals accepted, ${proposalResult.declined} declined`);
  }

  console.log("");
  console.log(`Done. ${summary.join("; ")}.`);
}
