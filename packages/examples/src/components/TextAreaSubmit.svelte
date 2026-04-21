<script lang="ts">
import TextBox from "$components/TextBox.svelte";
import type { TextAreaObject } from "$lib/types";
import SockethubButton from "./SockethubButton.svelte";

interface Props {
    buttonText?: string;
    disabled: boolean;
    obj: TextAreaObject;
    title: string;
    submitData: (text: string) => void;
}

let { buttonText = "Send", disabled, obj, title, submitData }: Props = $props();

let password = $state("");

let secretInputId = $derived(
    `secret-input-${title.toLowerCase().replace(/\s+/g, "-")}`,
);

$effect(() => {
    password = typeof obj.password === "string" ? obj.password : "";
});

const objString = $derived.by(() => {
    const redacted = { ...obj };
    delete redacted.password;
    return JSON.stringify(redacted, null, 3);
});

async function handleSubmit(): Promise<void> {
    const payload = { ...obj };
    if (password.length > 0) {
        payload.password = password;
    }
    submitData(JSON.stringify(payload));
}
</script>

<div class="w-full">
    <label for="json-object-{title}" class="form-label inline-block text-gray-900 font-bold mb-2">{title}</label>
    <TextBox title={title} data={objString}></TextBox>
</div>
{#if typeof obj.password === "string"}
    <div class="w-full p-2">
        <label for={secretInputId} class="inline-block text-gray-900 font-bold w-32">Password</label>
        <input id={secretInputId} bind:value={password} type="password" class="border-4" />
    </div>
{/if}
<div class="w-full text-right">
    <SockethubButton {disabled} buttonAction={handleSubmit}>{buttonText}</SockethubButton>
</div>
