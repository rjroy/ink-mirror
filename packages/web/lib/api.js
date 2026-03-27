/**
 * Client-side API client. Calls Next.js API routes which proxy to the daemon.
 * Used by React client components in the browser.
 */
async function fetchApi(path, options = {}) {
    const response = await fetch(`/api${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API error ${response.status}: ${text}`);
    }
    return response.json();
}
export async function createEntry(body, title) {
    return fetchApi("/entries", {
        method: "POST",
        body: JSON.stringify({ body, title }),
    });
}
export async function listEntries() {
    return fetchApi("/entries");
}
export async function getEntry(id) {
    return fetchApi(`/entries/${id}`);
}
export async function getCurationSession() {
    return fetchApi("/observations/pending");
}
export async function classifyObservation(id, status) {
    return fetchApi(`/observations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
    });
}
export async function getProfile() {
    return fetchApi("/profile");
}
export async function updateProfileRule(id, updates) {
    return fetchApi(`/profile/rules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
    });
}
export async function deleteProfileRule(id) {
    await fetchApi(`/profile/rules/${id}`, {
        method: "DELETE",
    });
}
export async function replaceProfile(markdown) {
    return fetchApi("/profile", {
        method: "PUT",
        body: JSON.stringify({ markdown }),
    });
}
/**
 * Subscribe to observation events via SSE.
 * Returns a cleanup function to close the connection.
 */
export function subscribeObservations(onObservation, onError) {
    const source = new EventSource("/api/events/observations");
    source.addEventListener("observation", (event) => {
        const observation = JSON.parse(event.data);
        onObservation(observation);
    });
    if (onError) {
        source.onerror = onError;
    }
    return () => source.close();
}
