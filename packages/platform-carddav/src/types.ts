export interface CardDavCredentials {
    object:
        | {
              type: "credentials";
              url: string;
              username: string;
              password: string;
          }
        | { type: "credentials"; url: string; token: string };
}

export interface AddressBookDescription {
    id: string;
    type: "addressBook";
    name: string;
    description?: string;
}

export interface ContactValue {
    value: string;
    types?: string[];
    preferred?: boolean;
}

export interface ContactAddress {
    types?: string[];
    preferred?: boolean;
    postOfficeBox?: string;
    extendedAddress?: string;
    street?: string;
    locality?: string;
    region?: string;
    postalCode?: string;
    country?: string;
}

export interface PreservedVCardProperty {
    /** Unfolded vCard content line retained verbatim for safe round-tripping. */
    raw: string;
}

export interface ContactInput {
    id?: string;
    etag?: string;
    type: "person";
    uid?: string;
    name: string;
    givenName?: string;
    additionalNames?: string[];
    familyName?: string;
    honorificPrefixes?: string[];
    honorificSuffixes?: string[];
    nickname?: string;
    emails?: ContactValue[];
    telephones?: ContactValue[];
    addresses?: ContactAddress[];
    organization?: string;
    title?: string;
    role?: string;
    urls?: ContactValue[];
    photoUrls?: string[];
    note?: string;
    birthday?: string;
    preservedProperties?: PreservedVCardProperty[];
}

export interface Contact extends ContactInput {
    id: string;
    uid: string;
    etag?: string;
    vcardVersion: "3.0" | "4.0";
    updateSupported: boolean;
}

export interface ContactQuery {
    type?: "contactQuery";
    text?: string;
    fields?: Array<"name" | "email" | "telephone" | "organization">;
    limit?: number;
}

export interface DeleteInput {
    id: string;
    type: "person";
    etag: string;
}
