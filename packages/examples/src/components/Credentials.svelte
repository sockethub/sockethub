<TextAreaSubmit
  title="Credentials"
  store={credentials}
  buttonText="Set Credentials"
  on:submit={sendCredentials}
  disabled={disabled} />

<script lang="ts">
  import TextAreaSubmit from "$components/TextAreaSubmit.svelte";
  import { sc } from "$lib/sockethub";
  import { get } from "svelte/store";

  export let credentials;
  export let actor;

  let disabled = true;

  $: {
    if ($actor.isSet) {
      disabled = $credentials.isSet;
    } else {
      disabled = true;
    }
  }

  function sendCredentials(data) {
    const creds = {
      context: "irc",
      type: "credentials",
      actor: get(actor).object.id,
      object: JSON.parse(data.detail.jsonString)
    };
    console.log('sending credentials: ', creds);
    sc.socket.emit('credentials', creds, (resp) => {
      if (resp?.error) {
        throw new Error(resp.error);
      }
      credentials.set({
        isSet: true,
        object: creds.object
      });
    });
  }
</script>
