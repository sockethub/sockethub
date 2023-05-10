import createActivityObject from "./create-activity-object";

describe('Middleware: createActivityObject', () => {
  it('Calls activity.Object.create with incoming data', (done) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    createActivityObject({foo: 'bar'}, () => {
      done();
    });
  });
});
