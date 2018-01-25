const fs = require('fs');

if (typeof(define) !== 'function') {
    var define = require('amdefine')(module);
}

define(['require'], function (require, IRC2AS) {
    let suites = [];
    suites.push({
        name: "irc2astests",
        desc: "collection of tests for irc2as",
        abortOnFail: true,
        setup: function (env, test) {
            const equal = require('fast-deep-equal');
            const validStreams = [
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
                {"@type":"update","actor":{"@type":"person","@id":"irc://slvrbckt@localhost","displayName":"slvrbckt"},"object":{"@type":"error","content":"Nickname is already in use."},"target":{"@type":"person","@id":"irc://nkj@localhost","displayName":"nkj"}},
                {"@type":"send","actor":{"@type":"person","@id":"irc://hyper_slvrbckt@localhost","displayName":"hyper_slvrbckt"},"target":{"displayName":"#kosmos-random"},"object":{"@type":"message","content":"-ssssssss"}},
                {"@type":"send","actor":{"@type":"room","@id":"irc://localhost/#kosmos-random"},"target":{"@type":"person","@id":"irc://slvrbckt@localhost"},"object":{"@type":"message","content":"You're not a channel operator"}},
                {"@type":"update","actor":{"@type":"person","@id":"irc://lio17@localhost","displayName":"lio17"},"target":{"@type":"room","@id":"irc://localhost/#kosmos-random","displayName":"#kosmos-random"},"object":{"@type":"topic","topic":"no longer boating in senegal"}},
                {"@type":"send","actor":{"@type":"person","@id":"irc://raucao@localhost","displayName":"raucao"},"target":{"displayName":"#kosmos-random"},"object":{"@type":"me","content":"is thinking about sending someone to get b33rz"}}
            ];
            const IRC2AS = require('./../index');
            const testData = fs.readFileSync('./test/irc-data.txt', 'utf-8');
            const irc2as = new IRC2AS({server: 'localhost'});

            irc2as.events.on('stream', (stream) => {
                delete stream.published;
                let matched = false;
                for (let i = 0; i <= validStreams.length; i++) {
                    matched = equal(stream, validStreams[i]);
                    if (matched) { 
                        return; 
                    }
                }
                if (! matched) {
                    test.fail('failed matching ' + JSON.stringify(stream));
                }
            });

            irc2as.events.on('unprocessed', (string) => {
                console.log('unprocessed> ' + string);
            });

            env.pongs = 0;
            irc2as.events.on('pong', (time) => {
                env.pongs++;
            });

            env.pings = 0;
            irc2as.events.on('ping', (time) => {
                env.pings++;
            });

            testData.split('\n').forEach((line) => {
                irc2as.input(line);    
            });
            test.done();
        },
        tests: [
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
            }
        ]
    });
    return suites;
});
