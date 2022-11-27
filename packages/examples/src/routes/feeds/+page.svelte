<Intro title="Feeds Platform Example">
  <title>Feeds Example</title>
  <p>The feeds platform fetches takes an RSS/ATOM feed URL and parses it, returning an array of Activity Objects for each entry.</p>
</Intro>

<Module>
  <ActivityActor actor={actor} />
</Module>

<Module>
  <div class="w-16 md:w-32 lg:w-48 grow w-full">
    <label for="URL" class="form-label inline-block text-gray-900 font-bold mb-2">Feed URL</label>
    <input id="URL" bind:value={url} class="border-4 grow w-full">
  </div>
  <div class="w-16 md:w-32 lg:w-48 w-full">
    <div class="flex gap-4 mt-6">
      <div>
        <SockethubButton disabled={!$actor.isSet} buttonAction={sendFetch}>Fetch</SockethubButton>
      </div>
    </div>
  </div>
</Module>

<Module>
  <Logger />
</Module>

<script lang="ts">
  import Intro from "$components/Intro.svelte";
  import Module from "$components/Module.svelte";
  import ActivityActor from "$components/ActivityActor.svelte";
  import SockethubButton from "$components/SockethubButton.svelte";
  import Logger, { addObject, ObjectType } from "$components/logs/Logger.svelte";
  import { sc } from "$lib/sockethub";
  import { getActorStore } from "$stores/ActorStore";

  const defaultActorId = 'https://sockethub.org/examples/feedsUser';
  const actor = getActorStore({
    isSet: false,
    object: {
      id: defaultActorId,
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
      actor: defaultActorId,
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
