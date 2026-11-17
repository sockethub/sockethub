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
    /** Validation message; replaces the hint and marks the input invalid */
    error?: string;
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
    error,
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
        aria-describedby={error || hint ? `${id}-hint` : undefined}
        aria-invalid={error ? true : undefined}
        class="input {error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''} {customClass}"
        oninput={onInput ? () => onInput(value) : undefined}
    />
    {#if error}
        <p id="{id}-hint" class="text-[13px] leading-relaxed text-red-700">{error}</p>
    {:else if hint}
        <p id="{id}-hint" class="hint">{hint}</p>
    {/if}
</div>
