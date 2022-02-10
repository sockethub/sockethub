module.exports = [
  { context: 'irc',
    type: 'update',
    actor: {
      type: 'service',
      id: 'localhost',
      name: 'localhost'
    },
    object: {
      type: 'topic',
      content: '- -'
    }
  },
  { context: 'irc',
    type: 'update',
    actor: {
      type: 'service',
      id: 'localhost',
      name: 'localhost'
    },
    object: {
      type: 'topic',
      content: "- on the https://freenode.live website for our call for volunteers and call for - participation. " +
        "If you are interested in sponsoring next year's event, please - send us an e-mail to sponsor@freenode.live " +
        "- - Thank you for using freenode! - -"
    }
  },
  { context: 'irc',
    type: 'update',
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
  { context: 'irc',
    type: 'update',
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
  { context: 'irc',
    type: 'leave',
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
  {context:"irc",type:"leave",actor:{type:"person",id:"jarlaxl_@localhost",name:"jarlaxl_"},target:{type:"service",id:"localhost"},object:{type:"message",content:"user has quit"}},
  {context:"irc",type:"join",actor:{id:"localhost",type:"service"},error:"no such channel sdfsdfsdfsdfsdf",target:{id:"sdfsdfsdfsdfsdf@localhost",type:"person"}},
  {context:"irc",type:"update",actor:{type:"person",id:"lio17@localhost",name:"lio17"},target:{type:"room",id:"localhost/#kosmos-random",name:"#kosmos-random"},object:{type:"topic","content":"testing123"}},
  {context:"irc",type:"send",actor:{type:"person",id:"hyper_slvrbckt@localhost",name:"hyper_slvrbckt"},target:{type:"room", id:"localhost/#kosmos-random",name:"#kosmos-random"},object:{type:"message",content:"-ssssssss"}},
  {context:"irc",type:"update",actor:{type:"person",id:"lio17@localhost",name:"lio17"},target:{type:"room",id:"localhost/#kosmos-random",name:"#kosmos-random"},object:{type:"topic","content":"no longer boating in senegal"}},
  {context:"irc",type:"send",actor:{type:"person",id:"raucao@localhost",name:"raucao"},target:{type:"room",id:"localhost/#kosmos-random",name:"#kosmos-random"},object:{type:"me",content:"is thinking about sending someone to get b33rz"}},
  {context:"irc",type:"update",object:{type:"presence",role:"member"},actor:{type:"person",id:"hyper_slvrbckt@localhost",name:"hyper_slvrbckt"},target:{type:"room",id:"localhost/#kosmos-random",name:"#kosmos-random"}},
  {context:"irc",type:"update",object:{type:"presence",role:"member"},actor:{type:"person",id:"hyper_slvrbckt@localhost",name:"hyper_slvrbckt"},target:{type:"room",id:"localhost/#kosmos-random",name:"#kosmos-random"}},
  {context:"irc",type:"update",object:{type:"presence",role:"member"},actor:{type:"person",id:"hyper_slvrbckt@localhost",name:"hyper_slvrbckt"},target:{type:"room",id:"localhost/#kosmos-random",name:"#kosmos-random"}},
  {context:"irc",type:"update",object:{type:"presence",role:"member"},actor:{type:"person",id:"hyper_slvrbckt@localhost",name:"hyper_slvrbckt"},target:{type:"room",id:"localhost/#kosmos-random",name:"#kosmos-random"}},
  {context:"irc",type:"update",actor:{type:"person",id:"hyper_slvrbckt@localhost",name:"hyper_slvrbckt"},target:{type:"room",id:"localhost/#kosmos-random",name:"#kosmos-random"},object:{type:"presence",role:"member"}},
  {context:"irc",type:"update",actor:{type:"person",id:"gregkare@localhost",name:"gregkare"},target:{type:"room",id:"localhost/#kosmos-random",name:"#kosmos-random"},object:{type:"presence",role:"member"}},
  {context:"irc",type:"update",actor:{type:"person",id:"slvrbckt@localhost",name:"slvrbckt"},target:{type:"room",id:"localhost/#kosmos",name:"#kosmos"},object:{type:"presence",role:"member"}},
  {context:"irc",type:"update",actor:{type:"person",id:"lio17@localhost",name:"lio17"},target:{type:"room",id:"localhost/#kosmos",name:"#kosmos"},object:{type:"presence",role:"member"}},
  {context:"irc",type:"update",actor:{type:"person",id:"M-silverbucket@localhost",name:"M-silverbucket"},target:{type:"room",id:"localhost/#kosmos",name:"#kosmos"},object:{type:"presence",role:"member"}},
  {context:"irc",type:"update",actor:{type:"person",id:"botka1@localhost",name:"botka1"},target:{type:"room",id:"localhost/#kosmos",name:"#kosmos"},object:{type:"presence",role:"member"}},
  {context:"irc",type:"update",actor:{type:"person",id:"derbumi@localhost",name:"derbumi"},target:{type:"room",id:"localhost/#kosmos",name:"#kosmos"},object:{type:"presence",role:"member"}},
  {context:"irc",type:"update",actor:{type:"person",id:"ChanServ@localhost",name:"ChanServ"},target:{type:"room",id:"localhost/#kosmos",name:"#kosmos"},object:{type:"presence",role:"member"}},
  {context:"irc",type:"update",actor:{type:"person",id:"gregkare@localhost",name:"gregkare"},target:{type:"room",id:"localhost/#kosmos",name:"#kosmos"},object:{type:"presence",role:"member"}},
  {context:"irc",type:"update",actor:{type:"person",id:"hal8000@localhost",name:"hal8000"},target:{type:"room",id:"localhost/#kosmos-random",name:"#kosmos-random"},object:{type:"presence",role:"member"}},
  {context:"irc",type:"update",actor:{type:"person",id:"bkero-@localhost",name:"bkero-"},target:{type:"room",id:"localhost/#kosmos",name:"#kosmos"},object:{type:"presence",role:"member"}},
  {context:"irc",type:"update",actor:{type:"person",id:"galfert@localhost",name:"galfert"},target:{type:"room",id:"localhost/#kosmos",name:"#kosmos"},object:{type:"presence",role:"member"}},
  {context:"irc",type:"update",actor:{type:"person",id:"raucao@localhost",name:"raucao"},target:{type:"room",id:"localhost/#kosmos",name:"#kosmos"},object:{type:"presence",role:"member"}},
  {context:"irc",type:"update",actor:{type:"person",id:"hal8000@localhost",name:"hal8000"},target:{type:"room",id:"localhost/#kosmos",name:"#kosmos"},object:{type:"presence",role:"member"}},
  {context:"irc",type:"update",actor:{type:"person",id:"bkero@localhost",name:"bkero"},target:{type:"room",id:"localhost/#kosmos",name:"#kosmos"},object:{type:"presence",role:"member"}},
  {context:"irc",type:"update",actor:{type:"person",id:"bumi[m]@localhost",name:"bumi[m]"},target:{type:"room",id:"localhost/#kosmos",name:"#kosmos"},object:{type:"presence",role:"member"}},
  {context:"irc",type:"update",actor:{type:"person",id:"slvrbckt@localhost"},target:{type:"room",id:"localhost/#debian"},error:"You're not a channel operator"},
  {context:"irc",type:"update",actor:{type:"person",id:"slvrbckt@localhost"},target:{type:"room",id:"localhost/#kosmos-random"},error:"You're not a channel operator"},
  {context:'irc',type: "add", actor: { type: "person", id: "alice@localhost", name: "alice" }, target: { type: "person", id: "Kilroy@localhost", name: "Kilroy" }, object: { type: "relationship", relationship: "role", subject: { type: "presence", role: "owner" }, object: { type: "room", id: "localhost/#Finnish", name: "#Finnish" } } },
  {context:'irc',type: "add", actor: { type: "person", id: "bob@localhost", name: "bob" }, target: { type: "person", id: "alice@localhost", name: "alice" }, object: { type: "relationship", relationship: "role", subject: { type: "presence", role: "participant" }, object: { type: "room", id: "localhost/#room_a", name: "#room_a" } } },
  {context:'irc',type: "add", actor: { type: "person", id: "alice@localhost", name: "alice" }, target: { type: "person", id: "bob@localhost", name: "bob" }, object: { type: "relationship", relationship: "role", subject: { type: "presence", role: "admin" }, object: { type: "room", id: "localhost/#room_b", name: "#room_b" } } },
  {context:"irc",type:"update",target:{type:"room",id:"localhost/#freenode-sponsors"},actor:{type:"person",id:"hyper_slvrbckt@localhost"},error:"Cannot join channel (+i) - you must be invited"},
  {context:"irc",type:"update",target:{type:"service",id:"localhost"},error:"Nickname is already in use.",actor:{type:"person",id:"nkj@localhost",name:"nkj"}},
  {context:"irc",type:"update",target:{type:"service",id:"localhost"},error:"Nickname is already in use.",actor:{type:"person",id:"slvrbckt@localhost",name:"slvrbckt"}},
  {context:"irc",type:"send",actor:{type:"service",id:"localhost"},object:{type:"message",content:"This nickname is registered. Please choose a different nickname, or identify via /msg NickServ identify <password>."},target:{type:"person",id:"boo@localhost",name:"boo"}},
  {context:"irc",type:"send",actor:{type:"service",id:"localhost"},object:{type:"message",content:"You have 30 seconds to identify to your nickname before it is changed."},target:{type:"person",id:"boo@localhost",name:"boo"}},
  {context:"irc",type:"send",actor:{type:"service",id:"localhost"},object:{type:"message",content:"You failed to identify in time for the nickname boo"},target:{type:"person",id:"boo@localhost",name:"boo"}},
  {context:"irc",type:"update",target:{type:"service",id:"localhost"},error:"Nick/channel is temporarily unavailable",actor:{type:"person",id:"boo@localhost",name:"boo"}},
  {context:"irc",type:"update",actor:{type:"person",id:"sh-WjwOE@localhost",name:"sh-WjwOE"},target:{type:"person",id:"woooo@localhost",name:"woooo"},object:{type:"address"}},
  {context:"irc","type":"send","actor":{"type":"service","id":"localhost"},"object":{"type":"message","content":"Last login from: ~slvrbckt@localhost on Feb 09 18:45:19 2022 +0000."},"target":{"type":"person","id":"slvrbckt@localhost","name":"slvrbckt"}},
  {"context":"irc","type":"join","actor":{"type":"person","id":"myuser@localhost","name":"myuser"},"target":{"type":"room","id":"localhost/#kosmos-random","name":"#kosmos-random"}},
  {"context":"irc","type":"update","actor":{"type":"person","id":"myuser@localhost","name":"myuser"},"target":{"type":"room","id":"localhost/#kosmos-random","name":"#kosmos-random"},"object":{"type":"presence","role":"member"}},
  {"context":"irc","type":"update","actor":{"type":"person","id":"botka@localhost","name":"botka"},"target":{"type":"room","id":"localhost/#kosmos-random","name":"#kosmos-random"},"object":{"type":"presence","role":"owner"}},
  {"context":"irc","type":"update","actor":{"type":"person","id":"foouser@localhost","name":"foouser"},"target":{"type":"room","id":"localhost/#kosmos-random","name":"#kosmos-random"},"object":{"type":"presence","role":"member"}},
];