<script lang="ts">
    import { run } from 'svelte/legacy';

import { connected } from "$lib/sockethub";
    interface Props {
        children?: import('svelte').Snippet;
    }

    let { children }: Props = $props();
export const disabled: boolean = false;
export const buttonAction = async (): Promise<void> => {
    console.log(`buttonAction click, disabled: ${disabled}`);
    return Promise.resolve();
};
let disabledState = $state(false);
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
