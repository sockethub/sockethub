const chai = require('chai');
const sinon = require('sinon');
const schemas = require('sockethub-schemas');
const fs = require("fs");
const equal = require('fast-deep-equal');
const expect = chai.expect;

const IRC2AS = require('./index');
const outputs = require('./index.test.data');
const ircdata = fs.readFileSync('./src/index.test.data.irc.txt', 'utf-8');
const inputs = ircdata.split('\n');

function matchStream(done) {
  return (stream) => {
    expect(typeof stream.published).to.eql('string');
    delete stream.published;
    let matched = false;
    for (let i = 0; i <= outputs.length; i++) {
      matched = equal(stream, outputs[i]);
      if (matched) {
        // when matched, remove output entry from list
        outputs.splice(i, 1);
        break;
      }
    }
    if (! matched) {
      console.log();
      console.log('available matches:' + JSON.stringify(outputs));
      console.log('failed to find match for: ' + JSON.stringify(stream));
      return done(new Error('failed matching ' + JSON.stringify(stream)));
    }
    const err = schemas.validator.validateActivityStream(stream);
    if (err) {
      return done(new Error(err + ' - ' + JSON.stringify(stream)));
    }
  };
}

describe('IRC2AS', () => {
  let irc2as, pongs = 0, pings = 0;
  // it("provides expected properties", () => {
  beforeEach(() => {
    irc2as = new IRC2AS({server: 'localhost'});
    expect(irc2as).to.have.property('events');
    expect(typeof irc2as.events.on).to.equal('function');
    irc2as.events.on('unprocessed', (string) => {
      console.log('unprocessed> ' + string);
    });
    irc2as.events.on('pong', (time) => {
      pongs++;
    });
    irc2as.events.on('ping', (time) => {
      pings++;
    });
  });

  describe('inputs generate expected outputs', () => {
    it("inputs generate expected outputs", (done) => {
      irc2as.events.on('incoming', matchStream(done));
      irc2as.events.on('error', matchStream(done));
      for (let i = 0; inputs.length > i; i++) {
        irc2as.input(inputs[i]);
      }
      setTimeout(() => {
        expect(outputs.length).to.equal(0);
        done();
      }, 0);
    });
    it("ping and pong count", () => {
      expect(pings).to.eql(2);
      expect(pongs).to.eql(3);
    });
  });

  describe('handle many room joins', () => {
    let totalCount = 0;
    it('send join messages', (done) => {
      irc2as.events.on('incoming', () => {
        totalCount += 1;
        if (totalCount === 5 * 100) {
          done();
        }
      });
      for (let i = 0; i < 5; i++) {
        let names = ':hitchcock.freenode.net 353 hyper_slvrbckt @ #kosmos-random :hyper_slvrbckt ';
        for (let n = 0; n < 100; n++) {
          names += ` gregkare${i}${n} hal8000${i}${n} botka${i}${n} raucao${i}${n} galfert${i}${n}`;
        }
        irc2as.input(names);
      }
      irc2as.input(':hitchcock.freenode.net 366 hyper_slvrbckt #kosmos-random :End of /NAMES list.');
    });
  });
});
