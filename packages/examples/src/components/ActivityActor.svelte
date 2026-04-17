<script lang="ts">
import TextAreaSubmit from "$components/TextAreaSubmit.svelte";
import { sc } from "$lib/sockethub";
import type { SockethubStateStore } from "$lib/types";
import type { ActivityActor } from "@sockethub/schemas";

interface Props {
    actor: ActivityActor;
    sockethubState: SockethubStateStore;
}

let { actor, sockethubState }: Props = $props();
let lastSubmittedActorId = $state<string | undefined>(undefined);

// If the actor ID changes after submission, clear dependent state so the user
// can create the actor and credentials again for the new identity.
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

function sendActivityObjectCreate(data: string) {
    const actorObj = JSON.parse(data);
    console.log("creating activity object:  ", actorObj);
    sc.ActivityStreams.Object.create(actorObj);
    sockethubState.set({
        actorSet: true,
        credentialsSet: false,
        connected: false,
        joined: false,
    });
    lastSubmittedActorId =
        typeof actorObj.id === "string" ? actorObj.id : undefined;
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
    submitData={sendActivityObjectCreate}
    disabled={$sockethubState.actorSet}
/>
