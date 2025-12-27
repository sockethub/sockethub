<script lang="ts">
import type { ActivityActor } from "@sockethub/schemas";
import TextAreaSubmit from "$components/TextAreaSubmit.svelte";
import { sc } from "$lib/sockethub";
import type { SockethubStateStore } from "$lib/types";

interface Props {
    actor: ActivityActor;
    sockethubState: SockethubStateStore;
}

let { actor, sockethubState }: Props = $props();

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
