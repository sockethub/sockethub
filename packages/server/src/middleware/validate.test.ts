import { expect } from 'chai';
import proxyquire from 'proxyquire';
import asObjects from "./validate.test.data";
import loadPlatforms, { PlatformMap, PlatformStruct } from "../bootstrap/load-platforms";
import validate, { registerPlatforms } from "./validate";
import { IActivityStream } from "@sockethub/schemas";
import { IInitObject } from "../bootstrap/init";

proxyquire.noPreserveCache();
proxyquire.noCallThru();

class FakeSockethubPlatform implements PlatformStruct {
  constructor() {}
  get config() {
    return {};
  }
  // @ts-ignore
  get schema() {
    return {
      name: 'fakeplatform',
      version: '0.0.1',
      credentials: {
        "required": [ 'object' ],
        "properties": {
          "actor": {
            "type": "object",
            "required": [ "id" ]
          },
          "object": {
            "type": "object",
            "required": [ 'type', 'user', 'pass' ],
            "additionalProperties": false,
            "properties" : {
              "type": {
                "type": "string"
              },
              "user" : {
                "type": "string"
              },
              "pass" : {
                "type": "string"
              }
            }
          }
        }
      },
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
  'fakeplatform': FakeSockethubPlatform
};

let platforms: PlatformMap;
let mockInit: IInitObject;
(async function () {
  // @ts-ignore
  platforms = await loadPlatforms(['fakeplatform'], async (module) => {
    // @ts-ignore
    return Promise.resolve(modules[module]);
  });
  mockInit = {
    version: "blah",
    platforms: platforms
  }
  await registerPlatforms(mockInit);
})();

describe("", () => {
    describe('platformLoad', () => {
      it('loads all platforms', () => {
        const expectedPlatforms = ['fakeplatform'];
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
                    validate(obj.type, 'tests', mockInit)(obj.input as IActivityStream, (msg) => {
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
