const fs = require('fs');

if (typeof(define) !== 'function') {
    var define = require('amdefine')(module);
}

function matchStream(env, test) {
    return (stream) => {
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
            console.log('available matches:' + JSON.stringify(env.validStreams));
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
                    '@type': 'update',
                    actor: { 
                        '@type': 'service',
                        '@id': 'irc://localhost',
                        displayName: 'localhost' 
                    },
                    object: { 
                        '@type': 'topic', 
                        content: [ '-', '-' ] 
                    }
                },
                {
                    '@type': 'observe',
                    actor: {
                        '@type': 'room',
                        '@id': 'irc://localhost/#kosmos-random',
                        displayName: '#kosmos-random' 
                    },
                    object: {   
                        '@type': 'attendance',
                        members: [ 
                            'hyper_slvrbckt',
                            'gregkare',
                            'hal8000',
                            'botka',
                            'raucao',
                            'galfert' 
                        ]
                    }
                },
                { 
                    '@type': 'update',
                    actor: {   
                        '@type': 'service',
                        '@id': 'irc://localhost',
                        displayName: 'localhost' 
                    },
                    object: {   
                        '@type': 'topic',
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
                { '@type': 'update',
                    actor: 
                    { '@type': 'person',
                        '@id': 'irc://donkey2018@localhost',
                        displayName: 'donkey2018' },
                    target: 
                    { '@type': 'person',
                        '@id': 'irc://slvrbckt@localhost',
                        displayName: 'slvrbckt' },
                    object: { '@type': 'address' } 
                },
                { '@type': 'update',
                    actor: 
                    { '@type': 'person',
                        '@id': 'irc://slvrbckt@localhost',
                        displayName: 'slvrbckt' },
                    target: 
                    { '@type': 'person',
                        '@id': 'irc://donkey2018@localhost',
                        displayName: 'donkey2018' },
                    object: { '@type': 'address' } 
                },
                { '@type': 'leave',
                    actor: 
                    { '@type': 'person',
                        '@id': 'irc://slvrbckt@localhost',
                        displayName: 'slvrbckt' },
                    target: 
                    { '@type': 'room',
                        '@id': 'irc://localhost/#debian',
                        displayName: '#debian' },
                    object: { '@type': 'message', content: 'user has left the channel' } 
                },
                {"@type":"leave",actor:{"@type":"person","@id":"irc://jarlaxl_@localhost",displayName:"jarlaxl_"},target:{"@type":"service","@id":"irc://localhost"},object:{"@type":"message",content:"user has quit"}},
                {"@type":"join",actor:{"@id":"irc://localhost","@type":"service"},object:{"@type":"error",content:"no such channel sdfsdfsdfsdfsdf"},target:{"@id":"irc://sdfsdfsdfsdfsdf@localhost","@type":"person"}},
                {"@type":"update","actor":{"@type":"person","@id":"irc://lio17@localhost","displayName":"lio17"},"target":{"@type":"room","@id":"irc://localhost/#kosmos-random","displayName":"#kosmos-random"},"object":{"@type":"topic","topic":"testing123"}},
                {"@type":"send","actor":{"@type":"person","@id":"irc://hyper_slvrbckt@localhost","displayName":"hyper_slvrbckt"},"target":{"displayName":"#kosmos-random"},"object":{"@type":"message","content":"-ssssssss"}},
                {"@type":"send","actor":{"@type":"room","@id":"irc://localhost/#kosmos-random"},"target":{"@type":"person","@id":"irc://slvrbckt@localhost"},"object":{"@type":"error","content":"You're not a channel operator"}},
                {"@type":"update","actor":{"@type":"person","@id":"irc://lio17@localhost","displayName":"lio17"},"target":{"@type":"room","@id":"irc://localhost/#kosmos-random","displayName":"#kosmos-random"},"object":{"@type":"topic","topic":"no longer boating in senegal"}},
                {"@type":"send","actor":{"@type":"person","@id":"irc://raucao@localhost","displayName":"raucao"},"target":{"displayName":"#kosmos-random"},"object":{"@type":"me","content":"is thinking about sending someone to get b33rz"}},
                {"@type":"observe","actor":{"@type":"room","@id":"irc://localhost/#kosmos","displayName":"#kosmos"},"object":{"@type":"attendance","members":["slvrbckt","lio17","M-silverbucket","botka1","derbumi","ChanServ","bkero-","galfert","raucao","hal8000","gregkare","bkero","bumi[m]"]}},
                {"@type":"observe","object":{"@type":"attendance","members":["hyper_slvrbckt"]},"actor":{"@type":"person","@id":"irc://undefined@localhost","displayName":"undefined"}},
                {"@type":"observe","object":{"@type":"attendance","members":["hyper_slvrbckt"]},"actor":{"@type":"person","@id":"irc://hyper_slvrbckt@localhost","displayName":"hyper_slvrbckt"}},
                {"@type":"observe","object":{"@type":"attendance","members":["hyper_slvrbckt"]},"actor":{"@type":"person","@id":"irc://hyper_slvrbckt@localhost","displayName":"hyper_slvrbckt"}},                
                {"@type":"observe","object":{"@type":"attendance","members":["hyper_slvrbckt"]},"actor":{"@type":"person","@id":"irc://hyper_slvrbckt@localhost","displayName":"hyper_slvrbckt"}},
                {"@type":"send","actor":{"@type":"room","@id":"irc://localhost/#debian"},"target":{"@type":"person","@id":"irc://slvrbckt@localhost"},"object":{"@type":"error","content":"You're not a channel operator"}},
                {"@type":"send","actor":{"@type":"room","@id":"irc://localhost/#freenode-sponsors"},"target":{"@type":"person","@id":"irc://hyper_slvrbckt@localhost"},"object":{"@type":"error","content":"Cannot join channel (+i) - you must be invited"}},
                {"@type":"update","actor":{"@type":"service","@id":"irc://localhost"},"object":{"@type":"error","content":"Nickname is already in use."},"target":{"@type":"person","@id":"irc://nkj@localhost","displayName":"nkj"}},
                {"@type":"update","actor":{"@type":"service","@id":"irc://localhost"},"object":{"@type":"error","content":"This nickname is registered. Please choose a different nickname, or identify via /msg NickServ identify <password>."},"target":{"@type":"person","@id":"irc://boo@localhost","displayName":"boo"}},
                {"@type":"update","actor":{"@type":"service","@id":"irc://localhost"},"object":{"@type":"error","content":"You have 30 seconds to identify to your nickname before it is changed."},"target":{"@type":"person","@id":"irc://boo@localhost","displayName":"boo"}},
                {"@type":"update","actor":{"@type":"service","@id":"irc://localhost"},"object":{"@type":"error","content":"You failed to identify in time for the nickname boo"},"target":{"@type":"person","@id":"irc://boo@localhost","displayName":"boo"}},
                {"@type":"update","actor":{"@type":"service","@id":"irc://localhost"},"object":{"@type":"error","content":"Nick/channel is temporarily unavailable"},"target":{"@type":"person","@id":"irc://boo@localhost","displayName":"boo"}},
                {"@type":"update","actor":{"@type":"service","@id":"irc://localhost"},"object":{"@type":"error","content":"Nickname is already in use."},"target":{"@type":"person","@id":"irc://slvrbckt@localhost","displayName":"slvrbckt"}},
                {"@type":"update","actor":{"@type":"person","@id":"irc://sh-WjwOE@localhost","displayName":"sh-WjwOE"},"target":{"@type":"person","@id":"irc://woooo@localhost","displayName":"woooo"},"object":{"@type":"address"}}
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
                    env.irc2as.events.on('incoming', (msg) => {
                        for (let i = 0; i < msg.object.members.length; i++)  {
                            console.log(msg.object.members[i])
                            test.assertTypeAnd(msg.object.members[i], 'string', msg.object.members[i]);
                        };
                        test.done();
                    });

                    for (let i = 0; i < 5; i++) {
                        let names = ':hitchcock.freenode.net 353 hyper_slvrbckt @ #kosmos-random :hyper_slvrbckt ';
                        for (let n = 0; n < 100; n++) {
                            names += ` gregkare${i}${n} hal8000${i}${n} botka${i}${n} raucao${i}${n} galfert${i}${n}`;
                        }
                        env.irc2as.input(names);
                    }
                    env.irc2as.input(':hitchcock.freenode.net 366 hyper_slvrbckt #kosmos-random :End of /NAMES list.')
                }
            }
        ]
    });
    return suites;
});
