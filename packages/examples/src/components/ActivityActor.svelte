<script lang="ts">
  import TextAreaSubmit from "$components/TextAreaSubmit.svelte";
  import { sc } from "$lib/sockethub";

  export let actor;
  export let state;

  function sendActivityObjectCreate(data) {
    const actorObj = JSON.parse(data.detail.jsonString);
    console.log("creating activity object:  ", actorObj);
    sc.ActivityStreams.Object.create(actorObj);
    state.set({
      actorSet: true,
      credentialsSet: false,
      connected: false,
      joined: false,
    });
    // actor.set({
    //   object: actorObj,
    //   roomId: "",
    // });
  }
</script>

<TextAreaSubmit
  title="Activity Stream Actor"
  obj={actor}
  buttonText="Activity Object Create"
  on:submit={sendActivityObjectCreate}
  disabled={$state.actorSet}
/>
