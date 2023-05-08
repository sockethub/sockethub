import { expect } from "chai";

import utils from "./utils";

describe('Utils', () => {
  describe('buildXmppCredentials', () => {
    it('returns correct credential object used for xmpp.js connect', () => {
      expect(utils.buildXmppCredentials({object: {
        userAddress: 'barney@dinosaur.com.au', password:'bar', resource: 'Home'
      }})).to.eql({
        password: 'bar',
        service: "dinosaur.com.au",
        username: "barney",
        resource: 'Home'
      });
    });
  });
  it('allows overriding server value', () => {
    expect(utils.buildXmppCredentials({object: {
      userAddress: 'barney@dinosaur.com.au', server:'foo', password:'bar', resource: 'Home'
    }})).to.eql({
      password: 'bar',
      service: "foo",
      username: "barney",
      resource: 'Home'
    });
  });
  it('allows a custom port', () => {
    expect(utils.buildXmppCredentials({object: {
      userAddress: 'barney@dinosaur.com.au', port:123, password:'bar', resource: 'Home'
    }})).to.eql({
      password: 'bar',
      service: "dinosaur.com.au:123",
      username: "barney",
      resource: 'Home'
    });
  });
});
