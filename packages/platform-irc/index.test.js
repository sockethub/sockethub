const proxyquire = require('proxyquire');
const chai = require('chai');
const schemas = require('@sockethub/schemas').default;
const expect = chai.expect;

const IRCPlatform = require('./index');

proxyquire.noPreserveCache();
proxyquire.noCallThru();

const actor = {
  type: 'person',
  id: 'testingham@irc.example.com',
  name:'testingham'
};

const newActor = {
  type: 'person',
  id: 'testler@irc.example.com',
  name:'testler'
};

const targetRoom = {
  type: 'room',
  id: 'irc.example.com/a-room',
  name: '#a-room'
};

const validCredentials = {
  context: 'irc',
  type: 'credentials',
  actor: actor,
  object: {
    type: 'credentials',
    nick: 'testingham',
    server: 'irc.example.com'
  }
};

let loadedSchema = false;

describe('Initialize IRC Platform', () => {
  let platform;
  beforeEach(() => {
    platform = new IRCPlatform({
      debug: function () { return null; },
      updateActor: function async() { return Promise.resolve(); }
    });
    platform.__connect = function (key, credentials, cb) {
      cb(null, {
        end: () => { return null; },
        on: function () { return null; },
        raw: () => { return null; }
      });
    };
    if (!loadedSchema) {
      schemas.addPlatformSchema(platform.schema.credentials, `irc/credentials`);
      loadedSchema = true;
    }
  });

  it('lists required types enum', () => {
    expect(platform.schema.messages.properties.type.enum).to.eql([
      'connect', 'update', 'join', 'leave', 'send', 'query', 'announce'
    ]);
  });

  it('returns a config object', () => {
    expect(platform.config).to.eql({
      persist: true,
      requireCredentials: ['connect', 'update'],
      initialized: false
    });
  });

  it('schema format validation', () => {
    expect(schemas.validatePlatformSchema(platform.schema)).to.equal("");
  });

  describe('credential schema', () => {
    it('valid credentials', () => {
      expect(schemas.validateCredentials(validCredentials)).to.equal("");
    });

    it('invalid credentials type', () => {
      expect(schemas.validateCredentials({
        context: 'irc',
        type: 'credentials',
        object: {
          host: 'example.com',
          port: '6667'
        }})).to.equal("[irc] /object: must have required property 'type'");
    });

    it('invalid credentials port', () => {
      expect(schemas.validateCredentials({
        context: 'irc',
        type: 'credentials',
        object: {
          type: 'credentials',
          host: 'example.com',
          port: '6667'
        }})).to.equal("[irc] /object/port: must be number");
    });

    it('invalid credentials additional prop', () => {
      expect(schemas.validateCredentials({
        context: 'irc',
        type: 'credentials',
        object: {
          type: 'credentials',
          host: 'example.com',
          port: 6667
        }})).to.equal("[irc] /object: must NOT have additional properties: host");
    });
  });

  describe('platform type methods', () => {
    beforeEach((done) => {
      platform.connect({
        context: 'irc',
        type: 'connect',
        actor: actor
      }, { object: { server: 'a server address' } }, done);
    });

    describe('after join', () => {
      beforeEach((done) => {
        platform.join({
          context: 'irc',
          type: 'join',
          actor: actor,
          target: targetRoom
        }, done);
        platform.__completeJob();
      });

      it('has join channel registered', () => {
        expect(platform.__channels.has('#a-room')).to.equal(true);
      });

      it('leave()', (done) => {
        platform.leave({
          context: 'irc',
          type: 'leave',
          actor: actor,
          target: targetRoom
        }, done);
        platform.__completeJob();
      });

      it('send()', (done) => {
        platform.send({
          context: 'irc',
          type: 'send',
          actor: actor,
          object: { content: 'har dee dar' },
          target: targetRoom
        }, done);
        platform.__completeJob();
      });

      it('update() topic', (done) => {
        platform.update({
          context: 'irc',
          type: 'update',
          actor: actor,
          object: { type: 'topic', content: 'important details' },
          target: targetRoom
        }, validCredentials, done);
        platform.__completeJob();
      });

      it('update() nick change', (done) => {
        platform.update({
          context: 'irc',
          type: 'update',
          actor: actor,
          object: { type: 'address' },
          target: newActor
        }, validCredentials, done);
        platform.__completeJob();
      });

      it('query()', (done) => {
        platform.query({
          context: 'irc',
          type: 'query',
          actor: actor,
          target: targetRoom,
          object: { type: 'attendance' },
        }, done);
        platform.__completeJob();
      });

      it('cleanup()', (done) => {
        platform.cleanup(() => {
          expect(platform.initialized).to.eql(false);
          done();
        });
      });
    });
  });
});
