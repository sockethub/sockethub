const SharedResources = {
  // collection of platform instances, stored by `id`
  platformInstances: (() => new Map())(),
  // collection of socket instances (referred to internally as session),
  // stored as `socket.id` from socket.io
  sessionConnections: (() => new Map())()
};
export default SharedResources;
