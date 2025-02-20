<script lang="ts">
import { connected } from "$lib/sockethub";
import { run } from "svelte/legacy";

interface Props {
    disabled: boolean;
    buttonAction: () => Promise<void>;
    children?: import("svelte").Snippet;
}

let { children, disabled, buttonAction }: Props = $props();
let disabledState = $state(disabled);

run(() => {
    if ($connected) {
        disabledState = disabled;
    } else {
        disabledState = true;
    }
});
</script>

<button
    onclick={buttonAction}
    class="hover:bg-blue-700 bg-blue-500 text-white font-bold py-2 px-4 rounded my-2 mx-4"
    disabled={disabledState}>{@render children?.()}</button
>
