<script lang="ts">
  import TextAreaSubmit from "$components/TextAreaSubmit.svelte";
  import { sc } from "$lib/sockethub";

  export let actor;

  $: obj = $actor.object;

  function sendActivityObjectCreate(data) {
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
  disabled={$actor.state.actorSet}
/>
