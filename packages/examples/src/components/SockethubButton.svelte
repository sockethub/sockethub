<script lang="ts">
    import { connected } from "$lib/sockethub";
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    export let disabled = false;
    export let buttonAction = async (): Promise<void> => {
        return Promise.resolve();
    };
    let disabledState = false;
    $: {
        if ($connected) {
            disabledState = disabled;
        } else {
            disabledState = true;
        }
    }
</script>

<button
    on:click={buttonAction}
    class="hover:bg-blue-700 bg-blue-500 text-white font-bold py-2 px-4 rounded my-2 mx-4"
    disabled={disabledState}><slot /></button
>
