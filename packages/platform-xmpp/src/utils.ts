import type { XmppElement } from "@xmpp/client";

import type { XmppBuiltCredentials, XmppCredentialsObject } from "./types.js";

interface XDataFieldResult {
    var: string;
    field: {
        type: string;
        label?: string;
        value: string | number | boolean | string[] | null;
        options?: Array<{ label: string; value: string }>;
    };
}

export const utils = {
    buildXmppCredentials: (
        credentials: XmppCredentialsObject,
    ): XmppBuiltCredentials => {
        const userAddress = credentials.object.userAddress;
        if (typeof userAddress !== "string" || !userAddress.includes("@")) {
            throw new Error(
                "xmpp credentials.object.userAddress must be a JID in the form 'user@server'",
            );
        }
        const [username, server] = userAddress.split("@");
        if (!username || !server) {
            throw new Error(
                "xmpp credentials.object.userAddress is missing the username or server portion",
            );
        }
        const xmpp_creds: XmppBuiltCredentials = {
            service: credentials.object.server
                ? credentials.object.server
                : server,
            username: username,
            password: credentials.object.password,
        };
        if (credentials.object.port) {
            xmpp_creds.service = `${xmpp_creds.service}:${credentials.object.port}`;
        }
        if (credentials.object.resource) {
            xmpp_creds.resource = credentials.object.resource;
        }
        return xmpp_creds;
    },

    parseXDataField: (field: XmppElement): XDataFieldResult | null => {
        const varAttr = field.attrs.var;
        if (!varAttr || varAttr === "FORM_TYPE") {
            return null;
        }

        const type = field.attrs.type || "text-single";
        const label = field.attrs.label;

        const values = field
            .getChildren("value")
            .map((v) => v.getText())
            .filter((t) => t !== undefined && t !== null);

        let value: string | number | boolean | string[] | null = null;
        if (type === "boolean") {
            if (values.length > 0) {
                const valStr = values[0].toLowerCase();
                value = valStr === "1" || valStr === "true";
            } else {
                value = false;
            }
        } else if (type === "text-multi" || type === "list-multi") {
            value = values;
        } else {
            if (values.length > 0) {
                const firstVal = values[0];
                if (type !== "list-single" && /^\d+$/.test(firstVal)) {
                    value = Number.parseInt(firstVal, 10);
                } else {
                    value = firstVal;
                }
            } else {
                value = null;
            }
        }

        const options = field.getChildren("option").map((opt) => {
            const optValEl = opt.getChild("value");
            const optVal = optValEl ? optValEl.getText() : "";
            return {
                label: opt.attrs.label || optVal,
                value: optVal,
            };
        });

        const fieldObj: XDataFieldResult["field"] = {
            type,
            ...(label && { label }),
            value,
            ...(options.length > 0 && { options }),
        };

        return {
            var: varAttr,
            field: fieldObj,
        };
    },
};
