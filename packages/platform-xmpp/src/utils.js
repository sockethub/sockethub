export const utils = {
    buildXmppCredentials: (credentials) => {
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
        const xmpp_creds = {
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

    parseXDataField: (field) => {
        const varAttr = field.attrs.var;
        if (!varAttr || varAttr === "FORM_TYPE") {
            return null;
        }

        const type = field.attrs.type || "text-single";
        const label = field.attrs.label;

        // Extract values
        const values = field
            .getChildren("value")
            .map((v) => v.getText())
            .filter((t) => t !== undefined && t !== null);

        // Coerce value based on type and count
        let value = null;
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
            // text-single, list-single, etc.
            if (values.length > 0) {
                const firstVal = values[0];
                if (type !== "list-single" && /^\d+$/.test(firstVal)) {
                    value = parseInt(firstVal, 10);
                } else {
                    value = firstVal;
                }
            } else {
                value = null;
            }
        }

        // Extract options
        const options = field.getChildren("option").map((opt) => {
            const optValEl = opt.getChild("value");
            const optVal = optValEl ? optValEl.getText() : "";
            return {
                label: opt.attrs.label || optVal,
                value: optVal,
            };
        });

        const fieldObj = {
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
