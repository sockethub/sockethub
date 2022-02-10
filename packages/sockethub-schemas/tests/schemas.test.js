const chai = require('chai');
const expect = chai.expect;
const schemaSHAS = require('./../schemas/activity-stream');
const validator = require('./../src/validator');

const testActivityStreams = require('./schemas.test.data');

describe('ActivityStream validation', () => {
  it('load schema', () => {
    expect(typeof schemaSHAS).to.equal('object');
    expect(schemaSHAS['$id']).to.equal('https://sockethub.org/schemas/v0/activity-stream#');
  });

  testActivityStreams.forEach(([name, AS, expectedResult, expectedFailureMessage]) => {
    it(`input object ` + name, () => {
      const err = validator.validateActivityStream(AS);
      expect(err).to.equal(expectedFailureMessage);
      expect(!err).to.equal(expectedResult);
    });
  })
});
