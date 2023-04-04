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

import asObjects from "./validate.test.data";
import platformsLoad from "../bootstrap/load-platforms";

describe("", () => {
    let platforms;
    let validate;
    beforeEach(async () => {
        // @ts-ignore
        platforms = await platformsLoad(['fake-sockethub-platform'], async (module) => {
          return Promise.resolve(modules[module]);
        });
        const validateMod = proxyquire('./validate', {
          '../bootstrap/init': {
            platforms: platforms
          }
        });
        validate = validateMod.default;
    });

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
})
