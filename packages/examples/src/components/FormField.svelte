<script lang="ts">
/**
 * Standardized form input field with consistent styling and labeling.
 * Supports all HTML input types and provides consistent spacing and accessibility.
 *
 * @example
 * ```svelte
 * <!-- Text input -->
 * <FormField label="Server" id="server" bind:value={serverName} />
 *
 * <!-- Number input with placeholder -->
 * <FormField
 *   label="Port"
 *   id="port"
 *   type="number"
 *   placeholder="6667"
 *   bind:value={portNumber}
 * />
 *
 * <!-- URL input -->
 * <FormField
 *   label="Feed URL"
 *   id="url"
 *   type="url"
 *   placeholder="https://example.com/feed.xml"
 *   bind:value={feedUrl}
 * />
 * ```
 */
interface Props {
    /** Label text displayed next to the input */
    label: string;
    /** Unique ID for the input element (required for accessibility) */
    id: string;
    /** HTML input type (text, number, url, email, etc.) */
    type?: string;
    /** Placeholder text shown when input is empty */
    placeholder?: string;
    /** Current value of the input (bindable) */
    value: string | number;
    /** Optional callback fired when input value changes */
    onInput?: (value: string | number) => void;
    /** Additional CSS classes to apply to the input */
    class?: string;
}

let {
    label,
    id,
    type = "text",
    placeholder = "",
    value = $bindable(),
    onInput,
    class: customClass = "",
}: Props = $props();

let inputClass = $derived(`border-4 ${customClass}`.trim());
</script>

<div class="w-full p-2">
    <label for={id} class="inline-block text-gray-900 font-bold w-32">{label}</label>
    <input 
        {id} 
        {type}
        {placeholder}
        bind:value 
        class={inputClass}
        oninput={onInput ? () => onInput(value) : undefined}
    />
</div>