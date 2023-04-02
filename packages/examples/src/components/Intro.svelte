<script>
  import ContentArea from "./ContentArea.svelte";
  export let title = "";
</script>

<ContentArea>
  <h1>{title}</h1>
  <div class="px-4 py-2">
    <slot />
  </div>
</ContentArea>
