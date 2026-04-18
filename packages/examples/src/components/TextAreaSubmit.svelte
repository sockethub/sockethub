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

let {
    buttonText = "Send",
    disabled,
    obj = $bindable(),
    title,
    submitData,
}: Props = $props();

const secretFieldOrder = ["password", "token"] as const;
type SecretField = (typeof secretFieldOrder)[number];

let secretField = $state<SecretField | null>(null);
let secretValue = $state("");

for (const field of secretFieldOrder) {
    const candidate = obj[field];
    if (typeof candidate === "string" && candidate.length > 0) {
        secretField = field;
        secretValue = candidate;
        obj[field] = undefined;
        break;
    }
}

const secretLabel = $derived(secretField === "token" ? "Token" : "Password");

const objString = $derived(JSON.stringify(obj, null, 3));

async function handleSubmit(): Promise<void> {
    if (secretField) {
        obj[secretField] = secretValue;
    }

    submitData(JSON.stringify(obj));
}
</script>

<div class="w-full">
    <label for="json-object-{title}" class="form-label inline-block text-gray-900 font-bold mb-2">{title}</label>
    <TextBox title={title} data={objString}></TextBox>
</div>
{#if secretField}
    <div class="w-full p-2">
        <label for="server" class="inline-block text-gray-900 font-bold w-32">{secretLabel}</label>
        <input id="server" bind:value={secretValue} type="password" class="border-4" />
    </div>
{/if}
<div class="w-full text-right">
    <SockethubButton {disabled} buttonAction={handleSubmit}>{buttonText}</SockethubButton>
</div>
