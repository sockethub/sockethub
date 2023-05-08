import {IActivityStream} from "./types";
import {expect} from "chai";

import ActivityStreamSchema from './schemas/activity-stream';
import ActivityObjectSchema from './schemas/activity-object';
import {
  validatePlatformSchema, addPlatformSchema, validateActivityObject,
  validateActivityStream, validateCredentials, getPlatformSchema
} from './validator';
import testCredentialsData from './index.test.data.credentials';
import testActivityObjectsData from './index.test.data.objects';
import testActivityStreamsData from './index.test.data.streams';
import testPlatformSchemaData from './index.test.data.platform';


describe('Platform schema validation', () => {
  it('returns an empty error for a valid schema', () => {
    const err = validatePlatformSchema(testPlatformSchemaData);
    expect(err).to.equal("");
  });
  it('returns an error for an invalid schema', () => {
    const err = validatePlatformSchema({foo: 'bar'});
    expect(err).to.eql(
      "platform schema failed to validate:  must have required property 'name'"
    );
  });
});


describe("Adding a PlatformSchema", () => {
  it('returns the same schema when fetched', () => {
    const platform_type = 'test-platform/credentials';
    addPlatformSchema(testPlatformSchemaData.credentials, platform_type);
    const compiledSchema = getPlatformSchema(platform_type);
    expect(compiledSchema.schema).to.eql(testPlatformSchemaData.credentials);
  });
});


describe('Credentials', () => {
  testCredentialsData.forEach(([name, creds, expectedResult, expectedFailureMessage]) => {
    describe("validateCredential " + name, () => {
      it(`returns expected result`, () => {
        const err = validateCredentials(creds as IActivityStream);
        expect(err).to.equal(expectedFailureMessage);
        expect(!err).to.equal(expectedResult);
      });
    });
  });
});

describe('ActivityObject', () => {
  it('has expected properties', () => {
    expect(typeof ActivityObjectSchema).to.equal('object');
    expect(ActivityObjectSchema['$id']).to.equal(
      'https://sockethub.org/schemas/v0/activity-object#');
  });

  testActivityObjectsData.forEach(([name, ao, expectedResult, expectedFailureMessage]) => {
    describe("validateActivityObject " + name, () => {
      it(`returns expected result`, () => {
        const err = validateActivityObject(ao as IActivityStream);
        expect(err).to.equal(expectedFailureMessage);
        expect(!err).to.equal(expectedResult);
      });
    });
  });
});

describe('ActivityStream', () => {
  it('has expected properties', () => {
    expect(typeof ActivityStreamSchema).to.equal('object');
    expect(ActivityStreamSchema['$id']).to.equal(
      'https://sockethub.org/schemas/v0/activity-stream#');
  });

  testActivityStreamsData.forEach(([name, as, expectedResult, expectedFailureMessage]) => {
    describe("validateActivityStream " + name, () => {
      it(`returns expected result`, () => {
        const err = validateActivityStream(as as IActivityStream);
        expect(err).to.equal(expectedFailureMessage);
        expect(!err).to.equal(expectedResult);
      });
    });
  });
});
