import { expect } from 'chai';

import validate from './validate';

import asObjects from "./validate.test.data";

describe('Middleware: Validate', () => {
  describe('AS object validations', () => {
    asObjects.forEach((obj) => {
      it(`${obj.type}: ${obj.name}, should ${obj.valid ? 'pass' : 'fail'}`, (done) => {
        // @ts-ignore
        validate(obj.type, 'tests')(obj.input, (msg) => {
          if (obj.output) {
            if (obj.output === 'same') {
              expect(obj.input).to.eql(msg);
            } else {
              expect(obj.output).to.eql(msg);
            }
          }
          if (obj.valid) {
            expect(msg instanceof Error).to.be.false;
          } else {
            expect(msg instanceof Error).to.be.true;
            if (obj.error) {
              expect(obj.error).to.equal(msg.toString());
            }
          }
          done();
        });
      });
    });
  });
});
