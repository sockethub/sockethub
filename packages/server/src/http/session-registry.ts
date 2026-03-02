/**
 * Tracks in-flight HTTP requests per platform instance so janitor doesn't
 * terminate platforms while an HTTP action is still processing.
 */
const httpSessionsByPlatform = new Map<string, number>();

export function registerHttpSession(platformId: string): void {
    const current = httpSessionsByPlatform.get(platformId) ?? 0;
    httpSessionsByPlatform.set(platformId, current + 1);
}

export function unregisterHttpSession(platformId: string): void {
    const current = httpSessionsByPlatform.get(platformId);
    if (!current) {
        return;
    }
    if (current <= 1) {
        httpSessionsByPlatform.delete(platformId);
        return;
    }
    httpSessionsByPlatform.set(platformId, current - 1);
}

export function hasHttpSessions(platformId: string): boolean {
    return httpSessionsByPlatform.has(platformId);
}
