<script lang="ts">
  import TextAreaSubmit from "$components/TextAreaSubmit.svelte";
  import { sc } from "$lib/sockethub";
  import type { BaseStore } from "$stores/BaseStore";
  import type { ActorData } from "$stores/ActorStore";
  import type { Payload } from "$lib/types";

  export let actor: BaseStore<ActorData>;

  $: obj = $actor.object;

  function sendActivityObjectCreate(data: Payload) {
    const actorObj = JSON.parse(data.detail.jsonString);
    console.log("creating activity object:  ", actorObj);
    sc.ActivityStreams.Object.create(actorObj);
    actor.set({
      state: {
        actorSet: true,
        credentialsSet: false,
        connected: false,
        joined: false,
      },
      object: actorObj,
      roomId: "",
    });
  }
</script>

<TextAreaSubmit
  title="Activity Stream Actor"
  {obj}
  buttonText="Activity Object Create"
  on:submit={sendActivityObjectCreate}
  disabled={$actor.state?.actorSet || false}
/>
