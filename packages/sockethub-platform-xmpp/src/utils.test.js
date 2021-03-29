const utils = require( "./utils");

describe('buildXmppCredentials', () => {
  it('returns correct credential object used for xmpp.js connect', () => {
    expect(utils.buildXmppCredentials({object: {
      username: 'barney@dinosaur.com.au', port:123, server:'foo', password:'bar', resource: 'Home'
    }})).toStrictEqual({
      password: 'bar',
      service: "dinosaur.com.au",
      username: "barney",
      resource: 'Home'
    });
  });
});