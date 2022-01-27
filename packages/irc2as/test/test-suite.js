const fs = require('fs');

if (typeof(define) !== 'function') {
    var define = require('amdefine')(module);
}

function matchStream(env, test) {
    return (stream) => {
        test.assertTypeAnd(stream.published, 'string');
        delete stream.published;
        let matched = false;
        for (let i = 0; i <= env.validStreams.length; i++) {
            matched = env.equal(stream, env.validStreams[i]);
            if (matched) {
                env.validStreams.splice(i, 1);
                return;
            }
        }
        if (! matched) {
            console.log();
            // console.log('available matches:' + JSON.stringify(env.validStreams));
            console.log('failed to find match for: ' + JSON.stringify(stream));
            test.fail('failed matching ' + JSON.stringify(stream));
        }
    }
}

define(['require'], function (require, IRC2AS) {
    let suites = [];
    suites.push({
        name: "irc2astests",
        desc: "collection of tests for irc2as",
        abortOnFail: true,
        setup: function (env, test) {
            env.equal = require('fast-deep-equal');
            env.validStreams = [
                {
                    type: 'update',
                    actor: {
                        type: 'service',
                        id: 'localhost',
                        name: 'localhost'
                    },
                    object: {
                        type: 'topic',
                        content: [ '-', '-' ]
                    }
                },
                {
                    type: 'update',
                    actor: {
                        type: 'service',
                        id: 'localhost',
                        name: 'localhost'
                    },
                    object: {
                        type: 'topic',
                        content: [
                            '- on the https://freenode.live website for our call for volunteers and call for',
                            '- participation. If you are interested in sponsoring next year\'s event, please',
                            '- send us an e-mail to sponsor@freenode.live',
                            '-',
                            '- Thank you for using freenode!',
                            '-',
                            '-'
                        ]
                    }
                },
                { type: 'update',
                    actor:
                    { type: 'person',
                        id: 'donkey2018@localhost',
                        name: 'donkey2018' },
                    target:
                    { type: 'person',
                        id: 'slvrbckt@localhost',
                        name: 'slvrbckt' },
                    object: { type: 'address' }
                },
                { type: 'update',
                    actor:
                    { type: 'person',
                        id: 'slvrbckt@localhost',
                        name: 'slvrbckt' },
                    target:
                    { type: 'person',
                        id: 'donkey2018@localhost',
                        name: 'donkey2018' },
                    object: { type: 'address' }
                },
                { type: 'leave',
                    actor:
                    { type: 'person',
                        id: 'slvrbckt@localhost',
                        name: 'slvrbckt' },
                    target:
                    { type: 'room',
                        id: 'localhost/#debian',
                        name: '#debian' },
                    object: { type: 'message', content: 'user has left the channel' }
                },
                {type:"leave",actor:{type:"person",id:"jarlaxl_@localhost",name:"jarlaxl_"},target:{type:"service",id:"localhost"},object:{type:"message",content:"user has quit"}},
                {type:"join",actor:{id:"localhost",type:"service"},object:{type:"error",content:"no such channel sdfsdfsdfsdfsdf"},target:{id:"sdfsdfsdfsdfsdf@localhost",type:"person"}},
                {type:"update","actor":{type:"person",id:"lio17@localhost","name":"lio17"},"target":{type:"room",id:"localhost/#kosmos-random","name":"#kosmos-random"},"object":{type:"topic","topic":"testing123"}},
                {type:"send","actor":{type:"person",id:"hyper_slvrbckt@localhost","name":"hyper_slvrbckt"},"target":{"name":"#kosmos-random"},"object":{type:"message","content":"-ssssssss"}},
                {type:"send","actor":{type:"room",id:"localhost/#kosmos-random"},"target":{type:"person",id:"slvrbckt@localhost"},"object":{type:"error","content":"You're not a channel operator"}},
                {type:"update","actor":{type:"person",id:"lio17@localhost","name":"lio17"},"target":{type:"room",id:"localhost/#kosmos-random","name":"#kosmos-random"},"object":{type:"topic","topic":"no longer boating in senegal"}},
                {type:"send","actor":{type:"person",id:"raucao@localhost","name":"raucao"},"target":{"name":"#kosmos-random"},"object":{type:"me","content":"is thinking about sending someone to get b33rz"}},
                {type:"update","object":{type:"presence","role":"member"},"actor":{type:"person",id:"hyper_slvrbckt@localhost","name":"hyper_slvrbckt"},"target":{type:"room",id:"localhost/#kosmos-random","name":"#kosmos-random"}},
                {type:"update","object":{type:"presence","role":"member"},"actor":{type:"person",id:"hyper_slvrbckt@localhost","name":"hyper_slvrbckt"},"target":{type:"room",id:"localhost/#kosmos-random","name":"#kosmos-random"}},
                {type:"update","object":{type:"presence","role":"member"},"actor":{type:"person",id:"hyper_slvrbckt@localhost","name":"hyper_slvrbckt"},"target":{type:"room",id:"localhost/#kosmos-random","name":"#kosmos-random"}},
                {type:"update","object":{type:"presence","role":"member"},"actor":{type:"person",id:"hyper_slvrbckt@localhost","name":"hyper_slvrbckt"},"target":{type:"room",id:"localhost/#kosmos-random","name":"#kosmos-random"}},
                {type:"update","actor":{type:"person",id:"hyper_slvrbckt@localhost","name":"hyper_slvrbckt"},"target":{type:"room",id:"localhost/#kosmos-random","name":"#kosmos-random"},"object":{type:"presence","role":"member"}},
                {type:"update","actor":{type:"person",id:"gregkare@localhost","name":"gregkare"},"target":{type:"room",id:"localhost/#kosmos-random","name":"#kosmos-random"},"object":{type:"presence","role":"member"}},
                {type:"update","actor":{type:"person",id:"slvrbckt@localhost","name":"slvrbckt"},"target":{type:"room",id:"localhost/#kosmos","name":"#kosmos"},"object":{type:"presence","role":"member"}},
                {type:"update","actor":{type:"person",id:"lio17@localhost","name":"lio17"},"target":{type:"room",id:"localhost/#kosmos","name":"#kosmos"},"object":{type:"presence","role":"member"}},
                {type:"update","actor":{type:"person",id:"M-silverbucket@localhost","name":"M-silverbucket"},"target":{type:"room",id:"localhost/#kosmos","name":"#kosmos"},"object":{type:"presence","role":"member"}},
                {type:"update","actor":{type:"person",id:"botka1@localhost","name":"botka1"},"target":{type:"room",id:"localhost/#kosmos","name":"#kosmos"},"object":{type:"presence","role":"member"}},
                {type:"update","actor":{type:"person",id:"derbumi@localhost","name":"derbumi"},"target":{type:"room",id:"localhost/#kosmos","name":"#kosmos"},"object":{type:"presence","role":"member"}},
                {type:"update","actor":{type:"person",id:"ChanServ@localhost","name":"ChanServ"},"target":{type:"room",id:"localhost/#kosmos","name":"#kosmos"},"object":{type:"presence","role":"member"}},
                {type:"update","actor":{type:"person",id:"gregkare@localhost","name":"gregkare"},"target":{type:"room",id:"localhost/#kosmos","name":"#kosmos"},"object":{type:"presence","role":"member"}},
                {type:"update","actor":{type:"person",id:"hal8000@localhost","name":"hal8000"},"target":{type:"room",id:"localhost/#kosmos-random","name":"#kosmos-random"},"object":{type:"presence","role":"member"}},
                {type:"update","actor":{type:"person",id:"bkero-@localhost","name":"bkero-"},"target":{type:"room",id:"localhost/#kosmos","name":"#kosmos"},"object":{type:"presence","role":"member"}},
                {type:"update","actor":{type:"person",id:"galfert@localhost","name":"galfert"},"target":{type:"room",id:"localhost/#kosmos","name":"#kosmos"},"object":{type:"presence","role":"member"}},
                {type:"update","actor":{type:"person",id:"raucao@localhost","name":"raucao"},"target":{type:"room",id:"localhost/#kosmos","name":"#kosmos"},"object":{type:"presence","role":"member"}},
                {type:"update","actor":{type:"person",id:"hal8000@localhost","name":"hal8000"},"target":{type:"room",id:"localhost/#kosmos","name":"#kosmos"},"object":{type:"presence","role":"member"}},
                {type:"update","actor":{type:"person",id:"bkero@localhost","name":"bkero"},"target":{type:"room",id:"localhost/#kosmos","name":"#kosmos"},"object":{type:"presence","role":"member"}},
                {type:"update","actor":{type:"person",id:"bumi[m]@localhost","name":"bumi[m]"},"target":{type:"room",id:"localhost/#kosmos","name":"#kosmos"},"object":{type:"presence","role":"member"}},
                {type:"send","actor":{type:"room",id:"localhost/#debian"},"target":{type:"person",id:"slvrbckt@localhost"},"object":{type:"error","content":"You're not a channel operator"}},
                { type: "add", "actor": { type: "person", id: "alice@localhost", "name": "alice" }, "target": { type: "person", id: "Kilroy@localhost", "name": "Kilroy" }, "object": { type: "relationship", "relationship": "role", "subject": { type: "presence", "role": "owner" }, "object": { type: "room", id: "localhost/#Finnish", "name": "#Finnish" } } },
                { type: "add", "actor": { type: "person", id: "bob@localhost", "name": "bob" }, "target": { type: "person", id: "alice@localhost", "name": "alice" }, "object": { type: "relationship", "relationship": "role", "subject": { type: "presence", "role": "participant" }, "object": { type: "room", id: "localhost/#room_a", "name": "#room_a" } } },
                { type: "add", "actor": { type: "person", id: "alice@localhost", "name": "alice" }, "target": { type: "person", id: "bob@localhost", "name": "bob" }, "object": { type: "relationship", "relationship": "role", "subject": { type: "presence", "role": "admin" }, "object": { type: "room", id: "localhost/#room_b", "name": "#room_b" } } },
                {type:"send","actor":{type:"room",id:"localhost/#freenode-sponsors"},"target":{type:"person",id:"hyper_slvrbckt@localhost"},"object":{type:"error","content":"Cannot join channel (+i) - you must be invited"}},
                {type:"update","actor":{type:"service",id:"localhost"},"object":{type:"error","content":"Nickname is already in use."},"target":{type:"person",id:"nkj@localhost","name":"nkj"}},
                {type:"update","actor":{type:"service",id:"localhost"},"object":{type:"error","content":"This nickname is registered. Please choose a different nickname, or identify via /msg NickServ identify <password>."},"target":{type:"person",id:"boo@localhost","name":"boo"}},
                {type:"update","actor":{type:"service",id:"localhost"},"object":{type:"error","content":"You have 30 seconds to identify to your nickname before it is changed."},"target":{type:"person",id:"boo@localhost","name":"boo"}},
                {type:"update","actor":{type:"service",id:"localhost"},"object":{type:"error","content":"You failed to identify in time for the nickname boo"},"target":{type:"person",id:"boo@localhost","name":"boo"}},
                {type:"update","actor":{type:"service",id:"localhost"},"object":{type:"error","content":"Nick/channel is temporarily unavailable"},"target":{type:"person",id:"boo@localhost","name":"boo"}},
                {type:"update","actor":{type:"service",id:"localhost"},"object":{type:"error","content":"Nickname is already in use."},"target":{type:"person",id:"slvrbckt@localhost","name":"slvrbckt"}},
                {type:"update","actor":{type:"person",id:"sh-WjwOE@localhost","name":"sh-WjwOE"},"target":{type:"person",id:"woooo@localhost","name":"woooo"},"object":{type:"address"}}
            ];
            const IRC2AS = require('./../index');
            env.testData = fs.readFileSync('./test/irc-data.txt', 'utf-8');
            env.irc2as = new IRC2AS({server: 'localhost'});

            env.irc2as.events.on('unprocessed', (string) => {
                console.log('unprocessed> ' + string);
            });

            env.pongs = 0;
            env.irc2as.events.on('pong', (time) => {
                env.pongs++;
            });

            env.pings = 0;
            env.irc2as.events.on('ping', (time) => {
                env.pings++;
            });
            test.done();
        },
        tests: [
            {
                desc: "test generated streams",
                abortOnFail: true,
                run: function (env, test) {
                    env.irc2as.events.on('incoming', matchStream(env, test));
                    env.irc2as.events.on('error', matchStream(env, test));

                    const lines = env.testData.split('\n');
                    for (let i = 0; lines.length > i; i++) {
                        env.irc2as.input(lines[i]);
                    }
                    setTimeout(() => {
                        test.assert(env.validStreams.length, 0);
                    }, 0);
                }
            },
            {
                desc: "verify ping count",
                run: function (env, test) {
                    test.assert(env.pings, 2);
                }
            },
            {
                desc: "verify pong count",
                run: function (env, test) {
                    test.assert(env.pongs, 3);
                }
            },
            {
                desc: "lots of people in a room",
                run: function (env, test) {
                    let totalCount = 0;
                    const IRC2AS = require('./../index');
                    let irc2as = new IRC2AS({server: 'localhost'});
                    irc2as.events.on('incoming', (msg) => {
                        totalCount += 1;
                        if (totalCount === 5 * 100) {
                            test.done();
                        }
                    });

                    for (let i = 0; i < 5; i++) {
                        let names = ':hitchcock.freenode.net 353 hyper_slvrbckt @ #kosmos-random :hyper_slvrbckt ';
                        for (let n = 0; n < 100; n++) {
                            names += ` gregkare${i}${n} hal8000${i}${n} botka${i}${n} raucao${i}${n} galfert${i}${n}`;
                        }
                        irc2as.input(names);
                    }
                    irc2as.input(':hitchcock.freenode.net 366 hyper_slvrbckt #kosmos-random :End of /NAMES list.')
                }
            }
        ]
    });
    return suites;
});
