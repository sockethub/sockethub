<script lang="ts">
  import TextAreaSubmit from "$components/TextAreaSubmit.svelte";
  import { sc } from "$lib/sockethub";
  import { get } from "svelte/store";
  import type { CredentialsObjectData } from "$stores/CredentialsStore";
  import type { BaseStore } from "$stores/BaseStore";
  import type { ActorData } from "$stores/ActorStore";

  export let credentials: CredentialsObjectData;
  export let actor: BaseStore<ActorData>;
  export let context: string;

  function sendCredentials(data: any) {
    const creds = {
      context: context,
      type: "credentials",
      actor: get(actor).object.id,
      object: JSON.parse(data.detail.jsonString),
    };
    console.log("sending credentials: ", creds);
    sc.socket.emit("credentials", creds, (resp: any) => {
      if (resp?.error) {
        throw new Error(resp.error);
      }
      if ($actor.state) {
        $actor.state.credentialsSet = true;
      }
    });
  }
</script>

<TextAreaSubmit
  title="Credentials"
  obj={credentials}
  buttonText="Set Credentials"
  on:submit={sendCredentials}
  disabled={!$actor.state?.actorSet || $actor.state?.credentialsSet || false}
/>
