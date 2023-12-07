<script lang="ts">
  import Intro from "$components/Intro.svelte";
  import ActivityActor from "$components/ActivityActor.svelte";
  import SockethubButton from "$components/SockethubButton.svelte";
  import Logger, { addObject, ObjectType } from "$components/logs/Logger.svelte";
  import { sc } from "$lib/sockethub";
  import type { AnyActivityStream } from "$lib/sockethub";
  import { getActorStore } from "$stores/ActorStore";

  const actorId = "https://sockethub.org/examples/feedsUser";
  const actor = getActorStore("feeds", {
    state: {
      actorSet: false,
    },
    object: {
      id: actorId,
      type: "person",
      name: "Sockethub Examples Feeds",
    },
  });

  let url = "https://sockethub.org/feed.xml";

  function send(obj: AnyActivityStream) {
    sc.socket.emit(
      "message",
      addObject(ObjectType.send, obj, obj.id || ""),
      (resp: AnyActivityStream) => {
        if (Array.isArray(resp)) {
          let i = 1;
          for (const r of resp.reverse()) {
            addObject(ObjectType.resp, r, `${r.id}.${i}`);
            i += 1;
          }
        } else {
          addObject(ObjectType.resp, resp, resp?.id || "");
        }
      },
    );
  }

  function getASObj(type: string) {
    return {
      context: "feeds",
      type: type,
      actor: actorId,
      target: {
        type: "feed",
        id: url,
      },
    };
  }

  async function sendFetch(): Promise<void> {
    send(getASObj("fetch"));
  }
</script>

<Intro title="Feeds Platform Example">
  <title>Feeds Example</title>
  <p>
    The feeds platform takes an RSS/ATOM feed URL, fetches and parses it, and returns an array of
    Activity Objects for each entry.
  </p>
</Intro>

<ActivityActor {actor} />

<div>
  <div class="w-full p-2">
    <label for="URL" class="inline-block text-gray-900 font-bold w-32">Feed URL</label>
    <input id="URL" bind:value={url} class="border-4" />
  </div>
  <div class="w-full text-right">
    <SockethubButton disabled={!$actor.state?.actorSet} buttonAction={sendFetch}
      >Fetch</SockethubButton
    >
  </div>
</div>

<Logger />
