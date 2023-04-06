import {ErrorObject} from "ajv";
import {ObjectTypesList} from "./objects";
import {IActivityStream, IActivityObject} from "../types";

interface TypeBreakdown {
  actor: Array<string>,
  object: Array<string>,
  target: Array<string>
}

function parseMsg(error: ErrorObject): string {
  let err = `${error.instancePath ? error.instancePath : 'activity stream'}: ${error.message}`;
  if (error.keyword === 'additionalProperties') {
    err += `: ${error.params.additionalProperty}`;
  } else if (error.keyword === 'enum') {
    err += `: ${error.params.allowedValues.join(', ')}`;
  }
  return err;
}


function getTypeList(msg: IActivityStream | IActivityObject): Array<string> {
  let types: Array<string> = [];
  types.push(msg?.type);
  for (const prop in msg) {
    const branch = msg[prop as unknown as keyof typeof msg];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (branch?.type) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      types = [...types, ...getTypeList(branch)];
    }
  }
  return types;
}

function getSchemaType(error: ErrorObject): string|undefined {
  const schemaTypeRes = error.schemaPath.match(/#\/\w+\/\w+\/([\w-]+)\//);
  return schemaTypeRes ? schemaTypeRes[1] : undefined;
}

function getErrType(error: ErrorObject): keyof TypeBreakdown|undefined {
  const errTypeRes = error.instancePath.match(/\/(\w+)/);
  return errTypeRes ? errTypeRes[1] as keyof TypeBreakdown : undefined;
}

function getPartsCount(error: ErrorObject, types: TypeBreakdown): number {
  const schemaType = getSchemaType(error);
  const errType = getErrType(error);
  if (!errType || !schemaType) { return -1; }
  if (!types[errType]) { return -1; }
  if (!types[errType].includes(schemaType)) { return -1; }
  const parts = error.instancePath.split('/');
  return parts.length;
}

function getTypes(msg: IActivityStream): TypeBreakdown {
  return {
    actor: getTypeList(msg.actor as IActivityObject),
    target: getTypeList(msg.target as IActivityObject),
    object: getTypeList(msg.context ? msg.object as IActivityObject : msg as IActivityStream)
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
  msg: IActivityStream,
  errors: ErrorObject[] | null | undefined
): string {
  const types = getTypes(msg);
  let deepest_entry = 0, highest_depth = -1;

  if (!errors) { return "validation failed with no error message"; }

  for (let i = 0; i < errors.length; i++) {
    const partsCount = getPartsCount(errors[i], types);
    if (partsCount > highest_depth) {
      highest_depth = partsCount;
      deepest_entry = i;
    }
  }

  return highest_depth >= 0 ?
    parseMsg(errors[deepest_entry]) :
    composeFinalError(errors[errors.length - 1]);
}

function composeFinalError(error: ErrorObject) {
  // if we have yet to build an error message, assume this is an invalid type value (oneOf),
  // try to build a list of valid types
  let msg: string;
  if (error.keyword === 'oneOf') {
    msg = `${error.instancePath}: ${error.message}: ` +
      `${ObjectTypesList.join(', ')}`;
  } else {
    msg = `${error.instancePath ?
      error.instancePath : 'activity stream'}: ${error.message}`;
  }
  if ("additionalProperty" in error.params) {
    msg += `: ${error.params.additionalProperty}`;
  }
  return msg;
}
