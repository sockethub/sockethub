<script lang="ts">
  import TextAreaSubmit from "$components/TextAreaSubmit.svelte";
  import { sc } from "$lib/sockethub";
  import type { ActorData } from "$lib/sockethub";
  import type { SockethubResponse, CredentialsObjectData } from "$lib/sockethub";
  import type { Payload, StateStore } from "$lib/types";

  export let credentials: CredentialsObjectData;
  export let actor: ActorData;
  export let state: StateStore;

  export let context: string;

  function sendCredentials(data: Payload) {
    const creds = {
      context: context,
      type: "credentials",
      actor: actor.id,
      object: JSON.parse(data.detail.jsonString),
    };
    console.log("sending credentials: ", creds);
    sc.socket.emit("credentials", creds, (resp: SockethubResponse) => {
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
  disabled={!$state.actorSet || $state.credentialsSet || false}
/>
