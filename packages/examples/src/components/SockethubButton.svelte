<button on:click={buttonAction}
        class="hover:bg-blue-700 bg-blue-500 text-white font-bold py-2 px-4 rounded"
        disabled="{!$connected}"><slot/></button>

<script lang="ts">
  import { connected } from "../lib/sockethub";
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  export let buttonAction = () => {};
</script>
