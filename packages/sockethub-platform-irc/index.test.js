const proxyquire = require('proxyquire');
const chai = require('chai');
const sinon = require('sinon');
const schemas = require('sockethub-schemas');
const Ajv = require('ajv');
const apply = require('ajv-formats-draft2019');
const expect = chai.expect;

const BASE_SCHEMA_ID = 'https://sockethub.org/schemas/v0/';
const ajv = new Ajv({strictTypes: false});
apply(ajv);

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
  id: 'irc.example.com/sockethub',
  name: '#sockethub'
};

const validCredentials = {
  actor: actor,
  object: {
    'type': 'credentials',
    nick: 'testingham',
    server: 'irc.example.com'
  }
};

describe('Initialize IRC Platform', () => {
  let platform;
  beforeEach(() => {
    platform = new IRCPlatform({
      debug: function () {},
      updateActor: function (obj) {}
    });
    platform.__connect = function (key, credentials, cb) {
      cb(null, {
        end: () => {},
        on: function () {},
        raw: () => {}
      });
    };
  });

  it('lists required types enum', () => {
    expect(platform.schema.messages.properties.type.enum).to.eql([
      'connect', 'update', 'join', 'leave', 'send', 'observe', 'announce'
    ]);
  });
  
  it('returns a config object', () => {
    expect(platform.config).to.eql({
      persist: true,
      requireCredentials: ['connect', 'update'],
      initialized: false
    });
  });

  it('schema format validation', (done) => {
    validate = ajv.compile(schemas.platform);
    if (! validate(platform.schema)) {
      done('schema validation failed');
    } else {
      done();
    }
  });

  it('valid credentials', (done) => {
    validate = ajv.compile(platform.schema.credentials);
    if (! validate(validCredentials)) {
      done('valid credentials did not pass validation');
    } else {
      done();
    }
  });

  it('invalid credentials', (done) => {
    validate = ajv.compile(platform.schema.credentials);
    if (! validate({
      host: 'example.com',
      port: '6667'
    })) {
      done();
    } else {
      done('invalid credentials passed validation');
    }
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
        expect(platform.__channels.has('#sockethub')).to.equal(true);
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

      it('observe()', (done) => {
        platform.observe({
          context: 'irc',
          type: 'observe',
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