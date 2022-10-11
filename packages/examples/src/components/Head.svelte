<ContentArea>
  <h1>{heading}</h1>
  <div class="px-4 py-2">
    <slot/>
  </div>
</ContentArea>

<script>
  import ContentArea from "./ContentArea.svelte";
  export let heading = "";
</script>
