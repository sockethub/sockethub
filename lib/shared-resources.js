const ArrayKeys = require('array-keys');
module.exports = {
    platformInstances: (() => {
        return new ArrayKeys();
    })(),
    socketConnections: (() => {
        return new ArrayKeys();             
    })(),  
}
