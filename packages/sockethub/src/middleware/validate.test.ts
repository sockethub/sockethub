import { expect } from 'chai';
import proxyquire from 'proxyquire';

proxyquire.noPreserveCache();
proxyquire.noCallThru();

// @ts-ignore
import platformLoad from './../bootstrap/platforms';
const packageJSON = require('./../../package.json');
const platforms = platformLoad(Object.keys(packageJSON.dependencies));

const validateMod = proxyquire('./validate', {
  '../bootstrap/init': {
    platforms: platforms
  }
});
const validate = validateMod.default;

import asObjects from "./validate.test.data";

describe('Middleware: Validate', () => {
  describe('AS object validations', () => {
    asObjects.forEach((obj) => {
      it(`${obj.type}: ${obj.name}, should ${obj.valid ? 'pass' : 'fail'}`, (done) => {
        // @ts-ignore
        validate(obj.type, 'tests')(obj.input, (msg) => {
          if (obj.output) {
            if (obj.output === 'same') {
              expect(msg).to.eql(obj.input);
            } else {
              expect(msg).to.eql(obj.output);
            }
          }
          expect(obj.valid).to.not.equal(msg instanceof Error);
          if (obj.error) {
            expect(msg.toString()).to.equal(obj.error);
          }
          done();
        });
      });
    });
  });
});
