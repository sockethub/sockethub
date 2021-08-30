const chai = require('chai');
const utils = require( "./utils");
const expect = chai.expect;

describe('Utils', () => {
  describe('buildXmppCredentials', () => {
    it('returns correct credential object used for xmpp.js connect', () => {
      expect(utils.buildXmppCredentials({object: {
        username: 'barney@dinosaur.com.au', port:123, server:'foo', password:'bar', resource: 'Home'
      }})).to.eql({
        password: 'bar',
        service: "dinosaur.com.au",
        username: "barney",
        resource: 'Home'
      });
    });
  });
});
