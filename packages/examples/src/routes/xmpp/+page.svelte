<Intro heading="XMPP Platform Example">
  <title>XMPP Example</title>
  <p>Example for the XMPP platform</p>
</Intro>

<Module>
  <div class="w-1/4">
  <p>Hello World</p>
  </div>
  <ConnectStatus status={online}/>
</Module>

<script>
  import Intro from "../../components/Intro.svelte";
  import Module from "../../components/Module.svelte";
  import ConnectStatus from "../../components/ConnectWidget.svelte";
  import '@sockethub/client/dist/sockethub-client.js';
  import { io } from 'socket.io-client';

  const activityObject = {
    context: "dummy",
    type: "",
    actor: 'https://sockethub.org/examples/dummyUser',
    object: {
      type: 'message',
      content: ""
    }
  };
  let sc;
  let online = false;

  // eslint-disable-next-line no-constant-condition
  if (typeof window) {
    let SockethubClient = window.SockethubClient;
    sc = new SockethubClient(io('http://localhost:10550', { path: '/sockethub' }));
    sc.socket.on('connect', () => {
      online = true;
    });
    sc.socket.on('error', (e) => {
      console.log('error: ', e);
    })
    sc.socket.on('disconnect', (e) => {
      console.log('disconnect: ', e);
      online = false;
    })
    sc.ActivityStreams.Object.create({
      id: 'https://sockethub.org/examples/dummyUser',
      type: "person",
      name: "Sockethub Examples - Dummy User"
    });
  }
</script>
