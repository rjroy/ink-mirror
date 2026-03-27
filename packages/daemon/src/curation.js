const UNDECIDED_CAP = 3;
/**
 * Patterns that indicate opposing ends of a dimension.
 * Each pair represents terms that, when found in pattern descriptions
 * within the same dimension, suggest a contradiction.
 */
const OPPOSING_SIGNALS = [
    [/\bshort\b/i, /\blong\b/i],
    [/\bbrief\b/i, /\blong\b/i],
    [/\bstaccato\b/i, /\bflowing\b/i],
    [/\bsimple\b/i, /\bcomplex\b/i],
    [/\bminimal\b/i, /\babundant\b/i],
    [/\bfew\b/i, /\bmany\b/i],
    [/\brare(?:ly)?\b/i, /\bfrequent(?:ly)?\b/i],
    [/\bavoids?\b/i, /\brelies on\b|uses? heavily\b/i],
    [/\bactive\b/i, /\bpassive\b/i],
    [/\bdeclarative\b/i, /\bcompound\b/i],
];
/**
 * Detects whether two observations in the same dimension describe opposing patterns.
 * Structural comparison: same dimension, opposing pattern signals.
 */
export function detectContradiction(a, b) {
    if (a.dimension !== b.dimension)
        return false;
    const patternA = a.pattern;
    const patternB = b.pattern;
    for (const [left, right] of OPPOSING_SIGNALS) {
        if ((left.test(patternA) && right.test(patternB)) ||
            (right.test(patternA) && left.test(patternB))) {
            return true;
        }
    }
    return false;
}
/**
 * Assembles a curation session from all observations.
 *
 * Order:
 * 1. New observations (status = "pending"), ordered by creation time
 * 2. Up to UNDECIDED_CAP most-recent undecided observations
 *
 * Contradiction detection: compares new (pending) observations against
 * confirmed (intentional) observations. Same dimension + opposing pattern
 * signals = contradiction surfaced for user resolution. (REQ-V1-19)
 */
export async function assembleCurationSession(allObservations, getEntryText) {
    const pending = allObservations
        .filter((o) => o.status === "pending")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const undecided = allObservations
        .filter((o) => o.status === "undecided")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, UNDECIDED_CAP);
    const confirmed = allObservations.filter((o) => o.status === "intentional");
    const sessionObs = [...pending, ...undecided];
    // Resolve entry text for all observations in the session
    const entryTextCache = new Map();
    const resolveText = async (entryId) => {
        if (entryTextCache.has(entryId))
            return entryTextCache.get(entryId);
        const text = (await getEntryText(entryId)) ?? "[source entry not found]";
        entryTextCache.set(entryId, text);
        return text;
    };
    const observations = [];
    for (const obs of sessionObs) {
        const entryText = await resolveText(obs.entryId);
        observations.push({ ...obs, entryText });
    }
    // Detect contradictions: new observations vs confirmed observations.
    // Limit to one contradiction per pending observation (the first confirmed match).
    // Surfacing multiple contradictions for the same observation adds noise, not clarity.
    const contradictions = [];
    for (const newObs of pending) {
        for (const conf of confirmed) {
            if (detectContradiction(newObs, conf)) {
                const newText = await resolveText(newObs.entryId);
                const confText = await resolveText(conf.entryId);
                contradictions.push({
                    newObservation: { ...newObs, entryText: newText },
                    confirmedObservation: { ...conf, entryText: confText },
                    dimension: newObs.dimension,
                });
                break;
            }
        }
    }
    return { observations, contradictions };
}
