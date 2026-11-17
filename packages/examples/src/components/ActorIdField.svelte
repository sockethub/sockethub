<script lang="ts">
import FormField from "./FormField.svelte";

interface Props {
    value: string;
    label?: string;
    hint?: string;
}

let { value = $bindable(), label = "Actor ID", hint }: Props = $props();
</script>

<FormField id="actor-id-input" {label} {hint} bind:value />
