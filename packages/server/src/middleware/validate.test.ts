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
import platformLoad from './../bootstrap/platforms';
const platforms = platformLoad(['fake-sockethub-platform'], (module) => {
  return modules[module];
});
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
      it(`${obj.type}: ${obj.name}, should ${obj.valid ? 'pass' : 'fail'}`, async () => {
        let msg;
        try {
          msg = await validate(obj.type, 'tests')(obj.input);
        } catch (err) {
          if (obj.valid) {
            expect(err instanceof Error).to.be.false;
          } else {
            expect(err instanceof Error).to.be.true;
            if (obj.error) {
              expect(obj.error).to.equal(err.toString());
            }
          }
        }
        if (obj.output) {
          if (obj.output === 'same') {
            expect(obj.input).to.eql(msg);
          } else {
            expect(obj.output).to.eql(msg);
          }
        }
      });
    });
  });
});
