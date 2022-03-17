import { expect } from 'chai';
import proxyquire from 'proxyquire';

proxyquire.noPreserveCache();
proxyquire.noCallThru();

class FakeSockethubPlatform {
  constructor() {}
  get config() {
    return {};
  }
  get schema() {
    return {
      name: 'fake',
      version: 'infinity',
      credentials: {},
      messages: {
        "required": ["type"],
        "properties": {
          "type": {
            "enum": ["echo", "fail"]
          }
        }
      }
    }
  }
}
const modules = {
  'fake-sockethub-platform': FakeSockethubPlatform
}

// @ts-ignore
import * as platformBootstrap from './../bootstrap/platforms';
platformBootstrap.injectRequire((module) => {
  return modules[module];
});
const platforms = platformBootstrap.platformLoad(['fake-sockethub-platform']);
const validateMod = proxyquire('./validate', {
  '../bootstrap/init': {
    platforms: platforms
  }
});
const validate = validateMod.default;

import asObjects from "./validate.test.data";

describe('platformLoad', () => {
  it('loads all platforms', () => {
    const expectedPlatforms = ['fake'];
    expect(platforms.size).to.equal(expectedPlatforms.length);
    for (let platform of expectedPlatforms) {
      expect(platforms.has(platform)).to.be.true;
    }
  });
});

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
          if (obj.valid) {
            expect(msg).to.not.be.instanceof(Error);
          } else {
            expect(msg).to.be.instanceof(Error);
            if (obj.error) {
              expect(msg.toString()).to.equal(obj.error);
            }
          }
          done();
        });
      });
    });
  });
});
