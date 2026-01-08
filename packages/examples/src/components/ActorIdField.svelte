<script lang="ts">
interface Props {
    value: string;
    class?: string;
}

let {
    value = $bindable(),
    class: customClass = "bg-white border border-solid border-gray-300 rounded",
}: Props = $props();
</script>

<div class="pb-4">
    <label for="actor-id-input" class="pr-3">Actor ID</label>
    <input
        id="actor-id-input"
        class={customClass}
        type="text"
        bind:value
    />
</div>