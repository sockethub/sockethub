if (typeof ActivityFactory !== 'function') {
  ActivityFactory = require('./../lib/activity-streams');
}
if (typeof chai !== 'object') {
  chai = require('chai')
}

const assert = chai.assert;
const expect = chai.expect;

describe('basic tests', () => {
  const config = {
    customProps: {
      credentials: [ 'secure' ]
    },
    specialObjs: [ 'dude']
  };
  let activity;

  before('initialize activity module', () => {
    assert.typeOf(ActivityFactory, 'function');
    activity = ActivityFactory(config);
  });

  describe('object tests', () => {
    it('should have the expected structure', () => {
      assert.typeOf(activity, 'object');
      assert.typeOf(activity.Object, 'object');
      assert.typeOf(activity.Stream, 'function');
      assert.typeOf(activity.on, 'function');
      assert.typeOf(activity.once, 'function');
      assert.typeOf(activity.off, 'function');
    });

    it('with no params returns undefined', () => {
      assert.equal(activity.Object.get(), undefined);
    });

    it('creates an object and exit when get', () => {
      expect(activity.Object.create({id: 'thingy1'})).to.deep.equal({'@id': 'thingy1'});
      expect(activity.Object.get('thingy1')).to.deep.equal({'@id':'thingy1'});
    });

    it('should throw an exception when called with no identifier', () => {
      expect(activity.Object.create).to.throw(Error);
    });

    it('create another object and exist when get', () => {
      expect(activity.Object.create({id: 'thingy2'})).to.deep.equal({'@id':'thingy2'});
      expect(activity.Object.get('thingy2')).to.deep.equal({'@id':'thingy2'});
    });
  });

  describe('stream tests', () => {
    let stream;

    beforeEach(() => {
      stream = activity.Stream({
        verb: 'lol',
        platform: 'irc',
        actor: 'thingy1',
        context: 'irc',
        object: { objectType: 'credentials', content: 'har', secure: true },
        target: [ 'thingy1', 'thingy2' ]
      });
    });

    it('should rename mapped props', () => {
      expect(stream['@type']).to.equal('lol');
      expect(stream.verb).to.not.exist;
      expect(stream.context).to.equal('irc');
      expect(stream.platform).to.not.exist;
    });

    it('should expand existing objects', () => {
      expect(stream.target).to.deep.equal([
        { '@id': 'thingy1' },
        { '@id': 'thingy2' }
      ]);
      expect(stream.actor).to.deep.equal({ '@id': 'thingy1' });
    });

    it('should handle customProps', () => {
      expect(stream.object).to.deep.equal(
        { '@type': 'credentials', content: 'har', secure: true }
      );
      expect(stream.object.objectType).to.not.exist;
    });

    it('should respect specialObj properties', () => {
      let stream2 = activity.Stream({
        '@type': 'lol',
        platform: 'irc',
        actor: 'thingy',
        object: { '@type': 'dude', foo: 'bar', content: 'har', secure: true },
        target: [ 'thingy1', 'thingy2' ]
      });
      expect(stream2).to.deep.equal({
        '@type': 'lol',
        context: 'irc',
        actor: { '@id': 'thingy' },
        target: [ { '@id': 'thingy1' }, { '@id': 'thingy2' }],
        object: { '@type': 'dude', foo: 'bar', content: 'har', secure: true }
      });
    })
  });

  describe('event emitions', () => {
    it('should fire on object creation', () => {
      activity.on('activity-object-create', (obj) => {
        expect(obj).to.deep.equal({ '@id': 'thingy3' });
      });
      activity.Object.create({ id:'thingy3' });
    });

    it('should fire on object deletion', () => {
      activity.on('activity-object-delete', (id) => {
        expect(id).to.equal('thingy2');
      });
      activity.Object.delete('thingy2');
    });
  });
});