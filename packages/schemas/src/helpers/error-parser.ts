import type { ErrorObject } from "ajv";
import type { ActivityObject, ActivityStream } from "../types.js";
import { ObjectTypesList } from "./objects.js";

interface TypeBreakdown {
    actor: Array<string>;
    object: Array<string>;
    target: Array<string>;
}

function parseMsg(error: ErrorObject): string {
    let err = `${
        error.instancePath ? error.instancePath : "activity stream"
    }: ${error.message}`;
    if (error.keyword === "additionalProperties") {
        err += `: ${error.params.additionalProperty}`;
    } else if (error.keyword === "enum") {
        err += `: ${error.params.allowedValues.join(", ")}`;
    }
    return err;
}

function getTypeList(msg: ActivityStream | ActivityObject): Array<string> {
    let types = [];
    types.push(msg?.type);
    for (const prop in msg) {
        if (msg[prop]?.type) {
            types = [...types, ...getTypeList(msg[prop])];
        }
    }
    return types;
}

function getSchemaType(error: ErrorObject): string {
    const schemaTypeRes = error.schemaPath.match(/#\/\w+\/\w+\/([\w-]+)\//);
    return schemaTypeRes ? schemaTypeRes[1] : undefined;
}

function getErrType(error: ErrorObject): string {
    const errTypeRes = error.instancePath.match(/\/(\w+)/);
    return errTypeRes ? errTypeRes[1] : undefined;
}

function getPartsCount(error: ErrorObject, types: TypeBreakdown): number {
    const schemaType = getSchemaType(error);
    const errType = getErrType(error);
    if (!errType) {
        return -1;
    }
    if (!types[errType]) {
        return -1;
    }
    if (!types[errType].includes(schemaType)) {
        return -1;
    }
    const parts = error.instancePath.split("/");
    return parts.length;
}

function getTypes(msg: ActivityStream): TypeBreakdown {
    return {
        actor: getTypeList(msg.actor),
        target: getTypeList(msg.target),
        object: getTypeList(msg.context ? msg.object : msg),
    };
}

/**
 * Traverses the errors array from ajv, and makes a series of filtering decisions to
 * try to arrive at the most useful error.
 * @param msg
 * @param errors
 * @returns {string}
 */
export default function getErrorMessage(
    msg,
    errors: Array<ErrorObject>,
): string {
    const types = getTypes(msg);
    let deepest_entry = 0;
    let highest_depth = -1;

    for (let i = 0; i < errors.length; i++) {
        const partsCount = getPartsCount(errors[i], types);
        if (partsCount > highest_depth) {
            highest_depth = partsCount;
            deepest_entry = i;
        }
    }

    return highest_depth >= 0
        ? parseMsg(errors[deepest_entry])
        : composeFinalError(errors[errors.length - 1]);
}

function composeFinalError(error) {
    // if we have yet to build an error message, assume this is an invalid type value (oneOf),
    // try to build a list of valid types
    let msg: string;
    if (error.keyword === "oneOf") {
        msg =
            `${error.instancePath}: ${error.message}: ` +
            `${ObjectTypesList.join(", ")}`;
    } else {
        msg = `${
            error.instancePath ? error.instancePath : "activity stream"
        }: ${error.message}`;
    }
    if ("additionalProperty" in error.params) {
        msg += `: ${error.params.additionalProperty}`;
    }
    return msg;
}
