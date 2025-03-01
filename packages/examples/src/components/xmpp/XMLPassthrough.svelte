<script lang="ts">
import TextAreaSubmit from "$components/TextAreaSubmit.svelte";
import { type ActorData, send } from "$lib/sockethub.js";
import type { SockethubResponse } from "$lib/sockethub.js";
import type { SockethubStateStore } from "$lib/types.js";

interface Props {
    xml: string;
    actor: ActorData;
    sockethubState: SockethubStateStore;
    context: string;
}
let { actor, xml, sockethubState, context }: Props = $props();

async function sendPassthrough(data: string) {
    return await send({
        context: context,
        type: "passthrough",
        actor: actor.id,
        object: {
            type: "xml",
            content: xml,
        },
    })
        .catch((err) => {
            console.error(err);
            throw new Error(err);
        })
        .then(() => {
            console.log("passthrough returned");
        });
}
</script>

<TextAreaSubmit
    title="XML Passthrough"
    obj={xml}
    buttonText="Send XML"
    submitData={sendPassthrough}
    disabled={!$sockethubState.actorSet || $sockethubState.credentialsSet || false}
/>
