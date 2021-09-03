const chai = require('chai');
const expect = chai.expect;
const Ajv = require('ajv');
const apply = require('ajv-formats-draft2019');
const schemaSHAS = require('./../schemas/activity-stream');

const BASE_SCHEMA_ID = 'https://sockethub.org/schemas/v0/';
const ajv = new Ajv({strictTypes: false});
apply(ajv);

const testActivityStreams = require('./schemas.test.data');

describe('ActivityStream validation', () => {
  const schemaId = BASE_SCHEMA_ID + 'activity-stream#';

  it('load schema', () => {
    expect(typeof schemaSHAS).to.equal('object');
    expect(schemaSHAS['$id']).to.equal(schemaId);
    ajv.addSchema(schemaSHAS, schemaSHAS.id);
  });

  testActivityStreams.forEach(([name, AS, expectedResult, expectedFailureMessage]) => {
    it(`input object ` + name, () => {
      const validate = ajv.getSchema(schemaId);
      const result = validate(AS);
      const msg = (validate.errors) ? `${validate.errors[0].instancePath}: ${validate.errors[0].message}` : '';
      expect(msg).to.equal(expectedFailureMessage);
      expect(result).to.equal(expectedResult);
    })
  })
});
