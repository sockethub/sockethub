
function ExamplesShared() {}

ExamplesShared.prototype.__displayPresenceUpdate = function (msg) {
  const status = (msg.object.status) ? ': ' + msg.object.status : '';
  let actor = msg.actor['@id'];
  if (msg.object.presence !== 'offline') {
    actor = document.createElement('a');
    actor.appendChild(document.createTextNode(msg.actor['@id']));
    actor.title = msg.actor['@id'];
    actor.href = msg.actor['@id'];
    $('#messages').append(actor);
    // actor = '<a class="actor" href="' + msg.actor['@id'] + '>' + msg.actor['@id'] + '</a>';
  }
  $('#messages')
    .append($('<li>').text(
      '[ ' + msg.actor['@id'] + ' is ' + msg.object.presence + ']' + status));
};

ExamplesShared.prototype.__displayMessageContent = function (msg) {
  const name = (typeof msg.actor === 'object') ?
    msg.actor.displayName || msg.actor['@id'] : msg['@type'];
  $('#messages').append($('<li>').text(name + ': ' + msg.object.content));
};

ExamplesShared.prototype.__displayUnknownContent = function (msg) {
  debug('unknown message, applying default display rule ', msg);
  $('#messages').append($('<li>').text(': ' + JSON.stringify(msg)));
};

ExamplesShared.prototype.processIncomingMessage = function (msg) {
  console.log('incoming message: ', msg);
  if (msg['@type'] === 'observe') {
    $('#messages').append($('<li>').text(` users in ${msg.actor.displayName}`))
      .append($('<li>').text(`  [ ${msg.object.members.join(', ')} ]`));
  } else if ((msg['@type'] === 'pong') || (msg['@type'] === 'ping')) {
    $('#messages').append($('<li>').text(
      `${msg['@type']} received from ${msg.actor['@id']} at ${msg.published}`));
  } else if ((msg['@type'] === 'update') && (msg.object['@type'] === 'address')) {
    $('#messages').append($('<li>').text(
      `${msg.actor.displayName} is now known as ${msg.target.displayName}`));
  } else if ((msg['@type'] === 'update') && (msg.object['@type'] === 'presence')) {
    this.__displayPresenceUpdate(msg);
  } else if ((msg['@type'] === 'add' || msg['@type'] === 'remove') &&
             (msg.object['@type'] === 'relationship')) {
    const action = msg['@type'] === 'add' ? 'set' : 'removed';
    $('#messages').append($('<li>').text(
      `${msg.actor.displayName} ${action} ${msg.object.relationship} of 
      ${msg.object.subject.role}`));
  } else if (msg['@type'] === 'join') {
    $('#messages').append($('<li>').text(
      `${msg.actor.displayName} has joined ${msg.target.displayName}`));
  } else if ((msg['@type'] === 'announce') && (msg.actor['@type'] === 'service')) {
    $('#messages').append($('<li>').text(`connected to ${msg.actor['@id']}`));
  } else if (msg['@type'] === 'error') {
    console.log('error received: ', msg);
  } else if (msg['@type'] === 'close') {
    console.log('close event received... offline.');
  } else if (msg.object && msg.object['@type'] === 'me') {
    $('#messages').append($('<li>').text(
      `* ${msg.actor.displayName} ${msg.object.content}`));
  } else if (msg.object && msg.object['@type'] === 'notice') {
    $('#messages').append($(
      '<li>').text(`NOTICE from ${msg.actor.displayName}: ${msg.object.content}`));
  } else if (msg.object && msg.object.content) {
    this.__displayMessageContent(msg);
  } else {
    this.__displayUnknownContent(msg);
  }
};
