import proxyquire from 'proxyquire';
import * as sinon from 'sinon';

proxyquire.noPreserveCache();
proxyquire.noCallThru();

describe('Middleware: createActivityObject', () => {
  let sandbox, createStub, createActivityObject;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    createStub = sinon.stub();
    const createActivityObjectMod = proxyquire('./create-activity-object', {
      'activity-streams': sinon.stub().returns({
        Object: {
          create: createStub
        }
      }),
      '../config': {
        get: sinon.stub()
      }
    });
    createActivityObject = createActivityObjectMod.default;
  });
  afterEach(() => {
    sinon.restore();
  });
  it('Calls activity.Object.create with incoming data', () => {
    createActivityObject({foo: 'bar'}, () => {
      sandbox.assert.calledWith(createStub, {foo: 'bar'});
    })
  });
});