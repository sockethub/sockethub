<script lang="ts">
  import TextAreaSubmit from "$components/TextAreaSubmit.svelte";
  import { sc } from "$lib/sockethub";

  export let credentials;
  export let actor;
  export let state;
  export let context: string;

  function sendCredentials(data) {
    const creds = {
      context: context,
      type: "credentials",
      actor: actor.id,
      object: JSON.parse(data.detail.jsonString),
    };
    console.log("sending credentials: ", creds);
    sc.socket.emit("credentials", creds, (resp) => {
      if (resp?.error) {
        throw new Error(resp.error);
      }
      $state.credentialsSet = true;
    });
  }
</script>

<TextAreaSubmit
  title="Credentials"
  obj={credentials}
  buttonText="Set Credentials"
  on:submit={sendCredentials}
  disabled={!$state.actorSet || $state.credentialsSet}
/>
