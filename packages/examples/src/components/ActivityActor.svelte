<script lang="ts">
import TextAreaSubmit from "$components/TextAreaSubmit.svelte";
import type { SockethubStateStore } from "$lib/types";
import type { ActivityActor } from "$lib/types/schemas";

interface Props {
    actor: ActivityActor;
    sockethubState: SockethubStateStore;
}

let { actor, sockethubState }: Props = $props();
let lastSubmittedActorId = $state<string | undefined>(undefined);

$effect(() => {
    if (
        $sockethubState.actorSet &&
        lastSubmittedActorId &&
        actor.id !== lastSubmittedActorId
    ) {
        $sockethubState.actorSet = false;
        if ("credentialsSet" in $sockethubState) {
            $sockethubState.credentialsSet = false;
        }
        if ("connected" in $sockethubState) {
            $sockethubState.connected = false;
        }
        if ("joined" in $sockethubState) {
            $sockethubState.joined = false;
        }
    }
});

function confirmActor(data: string) {
    const actorObj = JSON.parse(data);
    console.log("actor confirmed for this app session:", actorObj);
    sockethubState.set({
        actorSet: true,
        credentialsSet: false,
        connected: false,
        joined: false,
    });
    lastSubmittedActorId =
        typeof actorObj.id === "string" ? actorObj.id : undefined;
}
</script>

<TextAreaSubmit
    title="Actor"
    caption="actor"
    obj={actor}
    buttonText="Confirm actor"
    submitData={confirmActor}
    disabled={$sockethubState.actorSet}
/>
