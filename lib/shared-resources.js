module.exports = {
  platformInstances: (() => {
    return new Map();
  })(),
  socketConnections: (() => {
    return new Map();
  })(),
  platformMappings: (() => {
    return new Map();
  })()
};
