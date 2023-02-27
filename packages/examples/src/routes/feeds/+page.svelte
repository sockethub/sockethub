<script lang="ts">
  import Intro from "$components/Intro.svelte";
  import ActivityActor from "$components/ActivityActor.svelte";
  import SockethubButton from "$components/SockethubButton.svelte";
  import Logger, { addObject, ObjectType } from "$components/logs/Logger.svelte";
  import { sc } from "$lib/sockethub";
  import { getActorStore } from "$stores/ActorStore";

  const actorId = 'https://sockethub.org/examples/feedsUser';
  const actor = getActorStore('feeds', {
    state: {
      actorSet: false
    },
    object: {
      id: actorId,
      type: "person",
      name: "Sockethub Examples Feeds"
    }
  });

  let url = "https://sockethub.org/feed.xml";

  function send(obj) {
    sc.socket.emit('message', addObject(ObjectType.send, obj), (resp) => {
      if (Array.isArray(resp)) {
        let i = 1;
        for (const r of resp) {
          addObject(ObjectType.resp, r, `${r.id}-${i}`);
          ++i;
        }
      } else {
        addObject(ObjectType.resp, resp, resp.id);
      }
    });
  }

  function getASObj(type) {
    return {
      context: "feeds",
      type: type,
      actor: actorId,
      target: {
        type: "feed",
        id: url
      }
    };
  }

  function sendFetch() {
    send(getASObj("fetch"))
  }
</script>


<Intro title="Feeds Platform Example">
  <title>Feeds Example</title>
  <p>The feeds platform fetches takes an RSS/ATOM feed URL and parses it, returning an array of Activity Objects for each entry.</p>
</Intro>

<ActivityActor actor={actor} />

<div>
  <div class="w-full p-2">
    <label for="URL" class="inline-block text-gray-900 font-bold w-32">Feed URL</label>
    <input id="URL" bind:value={url} class="border-4">
  </div>
  <div class="w-full text-right">
    <SockethubButton disabled={!$actor.state.actorSet} buttonAction={sendFetch}>Fetch</SockethubButton>
  </div>
</div>

<Logger />
