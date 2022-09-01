import {expect} from 'chai';
import createActivityObject from "./create-activity-object";

describe('Middleware: createActivityObject', () => {
  it('Calls activity.Object.create with incoming data', async () => {
    const iobj = {foo: 'bar', type:'thing',actor:{id:'this', type:'person'},context:'thing'};
    const msg = await createActivityObject(iobj);
    expect(msg).to.eql(iobj);
  });
});