<TextAreaSubmit
  title="Activity Stream Actor"
  store={actor}
  buttonText="Activity Object Create"
  on:submit={sendActivityObjectCreate}
  disabled={$actor.isSet} />

<script lang="ts">
  import TextAreaSubmit from "$components/TextAreaSubmit.svelte";
  import { sc } from "$lib/sockethub";
  import { get } from "svelte/store";

  export let actor;

  function sendActivityObjectCreate(data) {
    const actorObj = JSON.parse(data.detail.jsonString);
    console.log('creating activity object:  ', actorObj);
    sc.ActivityStreams.Object.create(actorObj);
    actor.set({
      isSet: true,
      object: actorObj
    });
  }
</script>
