<script lang="ts">
/**
 * Labelled text input used across the examples.
 *
 * @example
 * ```svelte
 * <FormField label="Server" id="server" bind:value={serverName} />
 * <FormField label="Port" id="port" type="number" bind:value={port} />
 * ```
 */
interface Props {
    /** Label text displayed above the input */
    label: string;
    /** Unique ID for the input element (required for accessibility) */
    id: string;
    /** HTML input type (text, number, url, email, etc.) */
    type?: string;
    /** Placeholder text shown when input is empty */
    placeholder?: string;
    /** Helper text shown under the input */
    hint?: string;
    /** Current value of the input (bindable) */
    value: string | number;
    /** Optional callback fired when input value changes */
    onInput?: (value: string | number) => void;
    /** Additional CSS classes to apply to the input */
    class?: string;
    disabled?: boolean;
}

let {
    label,
    id,
    type = "text",
    placeholder = "",
    hint,
    value = $bindable(),
    onInput,
    class: customClass = "",
    disabled = false,
}: Props = $props();
</script>

<div class="w-full space-y-1.5">
    <label for={id} class="label">{label}</label>
    <input
        {id}
        {type}
        {placeholder}
        {disabled}
        bind:value
        aria-describedby={hint ? `${id}-hint` : undefined}
        class="input {customClass}"
        oninput={onInput ? () => onInput(value) : undefined}
    />
    {#if hint}
        <p id="{id}-hint" class="hint">{hint}</p>
    {/if}
</div>
