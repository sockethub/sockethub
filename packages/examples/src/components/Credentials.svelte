<script lang="ts">
import TextAreaSubmit from "$components/TextAreaSubmit.svelte";
import {
    actorAsObject,
    contextFor,
    ensureClientReady,
    sc,
} from "$lib/sockethub";
import type { ActorData } from "$lib/sockethub";
import type { CredentialsObjectData, SockethubResponse } from "$lib/sockethub";
import type { SockethubStateStore } from "$lib/types";

interface Props {
    credentials: CredentialsObjectData;
    actor: ActorData;
    sockethubState: SockethubStateStore;
    context: string;
}

let { credentials, actor, sockethubState, context }: Props = $props();

async function sendCredentials(data: string) {
    await ensureClientReady();
    const creds = {
        "@context": await contextFor(context),
        type: "credentials",
        actor: actorAsObject(actor),
        object: JSON.parse(data),
    };
    sc.socket.emit("credentials", creds, (resp: SockethubResponse) => {
        if (resp?.error) {
            throw new Error(resp.error);
        }
        $sockethubState.credentialsSet = true;
    });
}
</script>

<TextAreaSubmit
    title="Credentials"
    obj={credentials}
    buttonText="Set Credentials"
    submitData={sendCredentials}
    disabled={!$sockethubState.actorSet || $sockethubState.credentialsSet || false}
/>
