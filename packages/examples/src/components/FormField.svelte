<script lang="ts">
interface Props {
    label: string;
    id: string;
    type?: string;
    placeholder?: string;
    value: string | number;
    onInput?: (value: string | number) => void;
    class?: string;
}

let { 
    label, 
    id, 
    type = "text", 
    placeholder = "", 
    value = $bindable(),
    onInput,
    class: customClass = ""
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