export interface EditIdentity {
    id: string;
    etag?: string;
}

export type OpenEditDecision<T extends EditIdentity> =
    | { action: "retain"; contact: T }
    | { action: "reload"; contact: T }
    | { action: "clear" };

/**
 * Decide what an in-progress edit should do after a contact list refresh.
 *
 * The same etag means the stored card is unchanged, so the form can keep
 * what the user typed and the edit adopts the refreshed record for fields
 * the form does not edit. A different etag means the card was written again.
 * Saving the open form with that new etag would replace the newer card with
 * the stale form, so the form has to be reloaded from the refreshed contact
 * first. A contact that is absent from this result is dropped.
 */
export function reconcileOpenEdit<T extends EditIdentity>(
    editing: T,
    contacts: readonly T[],
): OpenEditDecision<T> {
    const refreshed = contacts.find((item) => item.id === editing.id);
    if (!refreshed) return { action: "clear" };
    if (refreshed.etag !== editing.etag)
        return { action: "reload", contact: refreshed };
    return { action: "retain", contact: refreshed };
}
