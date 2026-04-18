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

const secretFieldOrder = ["password", "token"] as const;
type SecretField = (typeof secretFieldOrder)[number];

let secretField = $state<SecretField | null>(null);
let secretValue = $state("");

function getSecretState(source: TextAreaObject): {
    field: SecretField | null;
    value: string;
} {
    for (const field of secretFieldOrder) {
        const candidate = source[field];
        if (typeof candidate === "string" && candidate.length > 0) {
            return { field, value: candidate };
        }
    }

    return { field: null, value: "" };
}

let secretInputId = $derived(
    `secret-input-${title.toLowerCase().replace(/\s+/g, "-")}`,
);
const secretLabel = $derived(secretField === "token" ? "Token" : "Password");

$effect(() => {
    const nextSecret = getSecretState(obj);
    secretField = nextSecret.field;
    secretValue = nextSecret.value;
});

const objString = $derived.by(() => {
    const redacted = { ...obj };

    for (const field of secretFieldOrder) {
        delete redacted[field];
    }

    return JSON.stringify(redacted, null, 3);
});

async function handleSubmit(): Promise<void> {
    const payload = { ...obj };

    if (secretField) {
        payload[secretField] = secretValue;
    }

    submitData(JSON.stringify(payload));
}
</script>

<div class="w-full">
    <label for="json-object-{title}" class="form-label inline-block text-gray-900 font-bold mb-2">{title}</label>
    <TextBox title={title} data={objString}></TextBox>
</div>
{#if secretField}
    <div class="w-full p-2">
        <label for={secretInputId} class="inline-block text-gray-900 font-bold w-32">{secretLabel}</label>
        <input id={secretInputId} bind:value={secretValue} type="password" class="border-4" />
    </div>
{/if}
<div class="w-full text-right">
    <SockethubButton {disabled} buttonAction={handleSubmit}>{buttonText}</SockethubButton>
</div>
