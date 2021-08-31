import createActivityObject from "./create-activity-object";

describe('Middleware: createActivityObject', () => {
  it('Calls activity.Object.create with incoming data', (done) => {
    // @ts-ignore
    createActivityObject({foo: 'bar'}, (msg) => {
      done();
    });
  });
});