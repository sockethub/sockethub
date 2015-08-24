require.config({
    paths: {
        jaribu: './../lib/jaribu',
        'jaribu/colors': './../lib/colors', 
        'jaribu/display': './../lib/display', 
        'jaribu/tools/Env': './../lib/tools/Env',
        'jaribu/Scaffolding': './../lib/Scaffolding', 
        'jaribu/Test': './../lib/Test', 
        'jaribu/Suite': './../lib/Suite',
        'jaribu/helpers': './../lib/helpers',
        'jaribu/tools/Write': './../lib/tools/Write', 
        'jaribu/tools/result': './../lib/tools/result',
        'jaribu/tools/assert': './../lib/tools/assert', 
        'jaribu/tools/assertType': './../lib/tools/assertType', 
        'jaribu/fakes/Stub': './../lib/fakes/Stub', 
        'jaribu/fakes/remoteStorageMock': './../lib/fakes/remoteStorageMock',
        'jaribu/tools/HttpServer': './../lib/tools/HttpServer', 
        'jaribu/tools/Throws': './../lib/tools/Throws',
        'jaribu/tools/WebSocketClient': './../lib/tools/WebSocketClient', 
        'jaribu/tools/WebSocketServer': './../lib/tools/WebSocketServer',
        'jaribu/testlib2': './../lib/testlib2',
        'jaribu/testlib': './../lib/testlib',
        'fetch': './../node_modules/whatwg-fetch/fetch'
    }
});

define([ 'jaribu' ], function (jaribu) {

    require(jaribuTestFiles, function () {
        var failedToLoad = [],
            suites = [];

        for (var i = 0, len = arguments.length; i < len; i += 1) {
            if (Array.isArray(arguments[i])) {
                suites = suites.concat(arguments[i]);
            } else {
                suites.push(arguments[i]);
            }
        }

        for (i = 0, len = suites.length; i < len; i += 1) {
            if (! jaribu.loadSuite(suites[i]) ) {
                jaribu.display.printn('unable to load suite: ' + suites[i].desc);
                jaribu.display.printn(jaribu.getErrorMessage());
                failedToLoad.push({ 'desc': suites[i].desc, 'error': jaribu.getErrorMessage() });
            }
        }

        jaribu.begin(function() {
            // on complete
            for (var i = 0, len = failedToLoad.length; i < len; i += 1) {
              jaribu.display.printn('suite failed to load: ' + failedToLoad[i].desc);
              jaribu.display.printn(failedToLoad[i].error);
            }
        });
    });

});
