<TextAreaSubmit
  title="Activity Stream Actor"
  obj={obj}
  buttonText="Activity Object Create"
  on:submit={sendActivityObjectCreate}
  disabled={$actor.state.actored} />

<script lang="ts">
  import TextAreaSubmit from "$components/TextAreaSubmit.svelte";
  import { sc } from "$lib/sockethub";

  export let actor;

  $: obj = $actor.object;

  $: {
    console.log('actor obj: ', obj);
  }

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
