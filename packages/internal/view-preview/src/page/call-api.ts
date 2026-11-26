// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Sends a request to the preview's server, and returns its answer. With a
 * body, it's a POST of the body as JSON, and without one, a GET. The
 * server's API is under the page's own path, as `<page>/api/<route>`.
 */
export async function callApi<T>(options: { readonly route: string; readonly body?: unknown }): Promise<T> {
    const { route, body } = options;
    const url = `${location.pathname.replace(/\/?$/, '/')}api/${route}`;
    const response = await fetch(url, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const answer = await response.json() as T & { readonly error?: string };
    if (!response.ok) throw new Error(answer.error ?? `The preview's server answered ${response.status}.`);
    return answer;
}
