const chai = require('chai');
const expect = chai.expect;
const schemaSHAS = require('./../schemas/activity-stream');
const schemaSHAO = require('./../schemas/activity-object');
const validator = require('./../src/validator');
const testCredentials = require('./schemas.test.data.credentials');
const testActivityObjects = require('./schemas.test.data.objects');
const testActivityStreams = require('./schemas.test.data.streams');
const platformSchema = require('./schemas.test.data.platform.schema');

describe('Platform schema validation', () => {
  it('validate correct platform schema', () => {
    let err = validator.validatePlatformSchema(platformSchema);
    expect(err).to.be.false;
  });
  it('validate incorrect platform schema', () => {
    let err = validator.validatePlatformSchema({foo:'bar'});
    expect(err).to.eql('platform schema failed to validate:  must have required property \'version\'');
  });
  it('add platform schema', () => {
    validator.addPlatformSchema(platformSchema.credentials, `test-platform/credentials`);
  });
})


describe('Credentials validation', () => {
  testCredentials.forEach(([name, creds, expectedResult, expectedFailureMessage]) => {
    it(`input object: ` + name, () => {
      const err = validator.validateCredentials(creds);
      expect(err).to.equal(expectedFailureMessage);
      expect(!err).to.equal(expectedResult);
    });
  })
});

describe('ActivityObject validation', () => {
  it('verify schema props', () => {
    expect(typeof schemaSHAO).to.equal('object');
    expect(schemaSHAO['$id']).to.equal('https://sockethub.org/schemas/v0/activity-object#');
  });

  testActivityObjects.forEach(([name, ao, expectedResult, expectedFailureMessage]) => {
    it(`input object: ` + name, () => {
      const err = validator.validateActivityObject(ao);
      expect(err).to.equal(expectedFailureMessage);
      expect(!err).to.equal(expectedResult);
    });
  })
});

describe('ActivityStream validation', () => {
  it('verify schema props', () => {
    expect(typeof schemaSHAS).to.equal('object');
    expect(schemaSHAS['$id']).to.equal('https://sockethub.org/schemas/v0/activity-stream#');
  });

  testActivityStreams.forEach(([name, as, expectedResult, expectedFailureMessage]) => {
    it(`input stream: ` + name, () => {
      const err = validator.validateActivityStream(as);
      expect(err).to.equal(expectedFailureMessage);
      expect(!err).to.equal(expectedResult);
    });
  })
});