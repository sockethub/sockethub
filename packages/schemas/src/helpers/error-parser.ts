import type { ErrorObject } from "ajv";
import type { ActivityObject, ActivityStream } from "../types.js";
import { ActorTypesList, ObjectTypesList, TargetTypesList } from "./objects.js";

export interface ValidationErrorOptions {
    excludeTypes?: Array<string>;
}

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
    const types: Array<string> = [];
    if (msg?.type) {
        types.push(msg.type);
    }
    const record = msg as Record<string, unknown>;
    for (const prop in record) {
        const value = record[prop];
        if (value && typeof value === "object" && "type" in value) {
            types.push(
                ...getTypeList(value as ActivityStream | ActivityObject),
            );
        }
    }
    return types;
}

function getSchemaType(error: ErrorObject): string | undefined {
    const schemaTypeRes = error.schemaPath.match(/#\/\w+\/\w+\/([\w-]+)\//);
    return schemaTypeRes ? schemaTypeRes[1] : undefined;
}

function getErrType(error: ErrorObject): string | undefined {
    const errTypeRes = error.instancePath.match(/\/(\w+)/);
    return errTypeRes ? errTypeRes[1] : undefined;
}

function getPartsCount(error: ErrorObject, types: TypeBreakdown): number {
    const schemaType = getSchemaType(error);
    const errType = getErrType(error);
    if (!errType) {
        return -1;
    }
    const typeList = (types as unknown as Record<string, Array<string>>)[
        errType
    ];
    if (!typeList) {
        return -1;
    }
    if (!schemaType || !typeList.includes(schemaType)) {
        return -1;
    }
    const parts = error.instancePath.split("/");
    return parts.length;
}

function getTypes(msg: ActivityStream): TypeBreakdown {
    return {
        actor: getTypeList(msg.actor),
        target: getTypeList(msg.target),
        object: getTypeList(msg["@context"] ? msg.object : msg),
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
    msg: ActivityStream,
    errors: Array<ErrorObject>,
    options?: ValidationErrorOptions,
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
        : composeFinalError(errors[errors.length - 1], options);
}

function filterTypeList(
    types: Array<string>,
    options?: ValidationErrorOptions,
): Array<string> {
    if (!options?.excludeTypes || options.excludeTypes.length === 0) {
        return types;
    }
    const exclude = new Set(options.excludeTypes);
    return types.filter((type) => !exclude.has(type));
}

function composeFinalError(
    error: ErrorObject,
    options?: ValidationErrorOptions,
): string {
    // if we have yet to build an error message, assume this is an invalid type value (oneOf),
    // try to build a list of valid types
    let msg: string;
    if (error.keyword === "oneOf") {
        const instanceRoot = error.instancePath.split("/")[1];
        const pathScopedTypes =
            instanceRoot === "actor"
                ? ActorTypesList
                : instanceRoot === "target"
                  ? TargetTypesList
                  : ObjectTypesList;
        const filteredTypes = filterTypeList(pathScopedTypes, options);
        const typesList =
            filteredTypes.length > 0 ? filteredTypes : pathScopedTypes;
        msg =
            `${error.instancePath}: ${error.message}: ` +
            `${typesList.join(", ")}`;
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
