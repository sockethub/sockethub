import ActivityObjectSchema from './schemas/activity-object';
import ActivityStreamSchema from './schemas/activity-stream';
import {
  validatePlatformSchema, addPlatformSchema,
  validateActivityStream,
  validateActivityObject,
  validateCredentials, getPlatformSchema,
} from "./validator";
import testCredentialsData from './index.test.data.credentials';
import testActivityObjectsData from './index.test.data.objects';
import testActivityStreamsData from './index.test.data.streams';
import testPlatformSchemaData from './index.test.data.platform';
import {IActivityStream} from "./types";

const chai = require('chai');
const expect = chai.expect;
describe('Platform schema validation', () => {
  it('returns an empty error for a valid schema', () => {
    let err = validatePlatformSchema(testPlatformSchemaData);
    expect(err).to.equal("");
  });
  it('returns an error for an invalid schema', () => {
    let err = validatePlatformSchema({foo: 'bar'});
    expect(err).to.eql('platform schema failed to validate:  must have required property \'name\'');
  });
});


describe("Adding a PlatformSchema", () => {
  it('returns the same schema when fetched', () => {
    const platform_type = 'test-platform/credentials';
    addPlatformSchema(testPlatformSchemaData.credentials, platform_type);
    const compiledSchema = getPlatformSchema(platform_type);
    // @ts-ignore
    expect(compiledSchema.schema).to.eql(testPlatformSchemaData.credentials);
  });
});


describe('Credentials', () => {
  testCredentialsData.forEach(([name, creds, expectedResult, expectedFailureMessage]) => {
    describe("validateCredential " + name, () => {
      it(`returns expected result`, () => {
        // @ts-ignore
        const err = validateCredentials(creds);
        expect(err).to.equal(expectedFailureMessage);
        expect(!err).to.equal(expectedResult);
      });
    });
  });
});

describe('ActivityObject', () => {
  it('has expected properties', () => {
    expect(typeof ActivityObjectSchema).to.equal('object');
    expect(ActivityObjectSchema['$id']).to.equal('https://sockethub.org/schemas/v0/activity-object#');
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
    expect(ActivityStreamSchema['$id']).to.equal('https://sockethub.org/schemas/v0/activity-stream#');
  });

  testActivityStreamsData.forEach(([name, as, expectedResult, expectedFailureMessage]) => {
    describe("validateActivityStream " + name, () => {
      it(`returns expected result`, () => {
        // @ts-ignore
        const err = validateActivityStream(as);
        expect(err).to.equal(expectedFailureMessage);
        expect(!err).to.equal(expectedResult);
      });
    });
  });
});
