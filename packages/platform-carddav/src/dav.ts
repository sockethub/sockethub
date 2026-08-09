import {
    asArray,
    type DavAuthentication,
    DavClient,
    DavFailure,
    type DavNetworkOptions,
    davHref,
    parseDavXml,
    propertyHref,
    rejectDavResponse,
    successfulProps,
} from "@sockethub/dav";
import type {
    AddressBookDescription,
    Contact,
    ContactInput,
    ContactQuery,
} from "./types.js";
import { buildVCard, parseVCard } from "./vcard.js";

const DAV_PROPS = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:carddav">
 <d:prop><d:current-user-principal/><c:addressbook-home-set/></d:prop>
</d:propfind>`;
const ADDRESS_BOOK_PROPS = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:carddav">
 <d:prop><d:resourcetype/><d:displayname/><c:addressbook-description/></d:prop>
</d:propfind>`;

function xml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function queryBody(query: ContactQuery): string {
    const fields = query.fields?.length
        ? query.fields
        : ["name", "email", "telephone", "organization"];
    const properties = new Set<string>();
    for (const field of fields) {
        if (field === "name") properties.add("FN").add("N");
        if (field === "email") properties.add("EMAIL");
        if (field === "telephone") properties.add("TEL");
        if (field === "organization") properties.add("ORG");
    }
    const filter = query.text
        ? `<c:filter test="anyof">${[...properties].map((name) => `<c:prop-filter name="${name}"><c:text-match collation="i;unicode-casemap" match-type="contains">${xml(query.text ?? "")}</c:text-match></c:prop-filter>`).join("")}</c:filter>`
        : `<c:filter><c:prop-filter name="UID"/></c:filter>`;
    return `<?xml version="1.0" encoding="utf-8"?>
<c:addressbook-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:carddav">
 <d:prop><d:getetag/><c:address-data content-type="text/vcard"/></d:prop>
 ${filter}
</c:addressbook-query>`;
}

export { DavFailure as CardDavFailure };

export class CardDavClient extends DavClient {
    constructor(
        url: string,
        authentication: DavAuthentication,
        timeoutMs = 15_000,
        networkOptions: DavNetworkOptions = {},
    ) {
        super(url, authentication, "carddav", timeoutMs, networkOptions);
    }

    async discoverAddressBooks(): Promise<AddressBookDescription[]> {
        try {
            return await this.discoverFrom(this.serviceUrl);
        } catch (error) {
            if (
                !(error instanceof DavFailure) ||
                !["carddav:not-found", "carddav:not-carddav"].includes(
                    error.code,
                )
            )
                throw error;
            const wellKnown = new URL("/.well-known/carddav", this.serviceUrl);
            if (wellKnown.href === this.serviceUrl.href) throw error;
            return this.discoverFrom(wellKnown);
        }
    }

    private async discoverFrom(
        entryUrl: URL,
    ): Promise<AddressBookDescription[]> {
        const initial = await this.propfind(entryUrl, 0, DAV_PROPS);
        const initialProps = successfulProps(initial[0] ?? {});
        let homeHref = propertyHref(initialProps["addressbook-home-set"]);
        if (!homeHref) {
            const principalHref = propertyHref(
                initialProps["current-user-principal"],
            );
            if (!principalHref) throw new DavFailure("carddav:not-carddav");
            const principalUrl = new URL(principalHref, entryUrl);
            this.assertAllowed(principalUrl);
            const principal = await this.propfind(principalUrl, 0, DAV_PROPS);
            homeHref = propertyHref(
                successfulProps(principal[0] ?? {})["addressbook-home-set"],
            );
        }
        if (!homeHref) throw new DavFailure("carddav:not-carddav");
        const homeUrl = new URL(homeHref, entryUrl);
        this.assertAllowed(homeUrl);
        const responses = await this.propfind(homeUrl, 1, ADDRESS_BOOK_PROPS);
        const books: AddressBookDescription[] = [];
        for (const response of responses) {
            const props = successfulProps(response);
            const resourceType = props.resourcetype as
                | Record<string, unknown>
                | undefined;
            if (!resourceType || !("addressbook" in resourceType)) continue;
            const responseHref = davHref(response.href);
            if (!responseHref) continue;
            const url = new URL(responseHref, homeUrl);
            this.assertAllowed(url);
            books.push({
                id: url.href,
                type: "addressBook",
                name:
                    typeof props.displayname === "string"
                        ? props.displayname
                        : url.pathname,
                ...(typeof props["addressbook-description"] === "string"
                    ? { description: props["addressbook-description"] }
                    : {}),
            });
        }
        return books;
    }

    async query(
        book: AddressBookDescription,
        query: ContactQuery = {},
    ): Promise<Contact[]> {
        const response = await this.request(new URL(book.id), {
            method: "REPORT",
            headers: {
                depth: "1",
                "content-type": "application/xml; charset=utf-8",
            },
            body: queryBody(query),
        });
        if (response.status !== 207)
            return rejectDavResponse(response, "carddav:query-failed");
        let parsed: Record<string, unknown>;
        try {
            parsed = parseDavXml(await response.text());
        } catch {
            throw new DavFailure("carddav:invalid-response");
        }
        const contacts: Contact[] = [];
        for (const item of asArray(
            (parsed.multistatus as Record<string, unknown> | undefined)
                ?.response as
                | Record<string, unknown>
                | Record<string, unknown>[],
        )) {
            const props = successfulProps(item);
            const itemHref = davHref(item.href);
            const data = props["address-data"];
            if (!itemHref || typeof data !== "string") continue;
            try {
                contacts.push(
                    parseVCard(
                        data,
                        new URL(itemHref, book.id).href,
                        typeof props.getetag === "string"
                            ? props.getetag
                            : undefined,
                    ),
                );
            } catch {
                throw new DavFailure("carddav:invalid-response");
            }
            if (query.limit && contacts.length >= query.limit) break;
        }
        return contacts;
    }

    async create(
        book: AddressBookDescription,
        input: ContactInput,
    ): Promise<{ id: string; uid: string; etag?: string }> {
        // Preservation data is accepted only from the authoritative card
        // fetched during update, never from a connected client during create.
        const card = buildVCard(
            { ...input, preservedProperties: undefined },
            [],
        );
        const resource = new URL(
            `${encodeURIComponent(card.uid)}.vcf`,
            book.id.endsWith("/") ? book.id : `${book.id}/`,
        );
        this.assertAllowed(resource);
        const response = await this.request(resource, {
            method: "PUT",
            headers: {
                "content-type": "text/vcard; charset=utf-8",
                "if-none-match": "*",
            },
            body: card.body,
        });
        if (response.status === 412)
            return rejectDavResponse(response, "carddav:conflict");
        if (response.status === 404)
            return rejectDavResponse(response, "carddav:not-found");
        if (!response.ok)
            return rejectDavResponse(response, "carddav:create-failed");
        await response.body?.cancel().catch(() => {});
        const location = response.headers.get("location");
        const finalUrl = location ? new URL(location, resource) : resource;
        this.assertAllowed(finalUrl);
        return {
            id: finalUrl.href,
            uid: card.uid,
            etag: response.headers.get("etag") ?? undefined,
        };
    }

    async update(
        input: ContactInput & { id: string; uid: string; etag: string },
    ) {
        const resource = new URL(input.id);
        this.assertAllowed(resource);
        const current = await this.request(resource, {
            method: "GET",
            headers: { "if-match": input.etag },
        });
        if (current.status === 412)
            return rejectDavResponse(current, "carddav:conflict");
        if (current.status === 404)
            return rejectDavResponse(current, "carddav:not-found");
        if (!current.ok)
            return rejectDavResponse(current, "carddav:update-failed");
        let stored: Contact;
        try {
            stored = parseVCard(await current.text(), input.id, input.etag);
        } catch {
            throw new DavFailure("carddav:unsupported-update");
        }
        if (stored.uid !== input.uid)
            throw new DavFailure("carddav:uid-mismatch");
        const card = buildVCard(input, stored.preservedProperties);
        const response = await this.request(resource, {
            method: "PUT",
            headers: {
                "content-type": "text/vcard; charset=utf-8",
                "if-match": input.etag,
            },
            body: card.body,
        });
        if (response.status === 412)
            return rejectDavResponse(response, "carddav:conflict");
        if (response.status === 404)
            return rejectDavResponse(response, "carddav:not-found");
        if (!response.ok)
            return rejectDavResponse(response, "carddav:update-failed");
        await response.body?.cancel().catch(() => {});
        return {
            id: resource.href,
            uid: card.uid,
            etag: response.headers.get("etag") ?? undefined,
        };
    }

    async delete(id: string, etag: string): Promise<void> {
        const resource = new URL(id);
        this.assertAllowed(resource);
        const response = await this.request(resource, {
            method: "DELETE",
            headers: { "if-match": etag },
        });
        if (response.status === 412)
            return rejectDavResponse(response, "carddav:conflict");
        if (response.status === 404)
            return rejectDavResponse(response, "carddav:not-found");
        if (!response.ok)
            return rejectDavResponse(response, "carddav:delete-failed");
        await response.body?.cancel().catch(() => {});
    }
}
