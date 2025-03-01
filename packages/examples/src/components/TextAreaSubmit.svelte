<script lang="ts">
import TextBox from "$components/TextBox.svelte";
import type { TextAreaObject } from "$lib/types";
import SockethubButton from "./SockethubButton.svelte";

interface Props {
    buttonText?: string;
    disabled: boolean;
    obj: TextAreaObject | string;
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

let password = $state("unset");

if (typeof obj === "object" && obj.password) {
    password = obj.password;
    obj.password = undefined;
}

const objString = $derived(
    typeof obj === "string" ? obj : JSON.stringify(obj, null, 3),
);

async function handleSubmit(): Promise<void> {
    console.log("PASSWORD: ", password);
    if (password !== "unset" && typeof obj === "object") {
        obj.password = password;
    }

    submitData(JSON.stringify(obj));
}
</script>

<div class="w-full">
    <label for="json-object-{title}" class="form-label inline-block text-gray-900 font-bold mb-2">{title}</label>
    <TextBox title={title} data={objString}></TextBox>
</div>
{#if password !== "unset"}
    <div class="w-full p-2">
        <label for="server" class="inline-block text-gray-900 font-bold w-32">Password</label>
        <input id="server" bind:value={password} type="password" class="border-4" />
    </div>
{/if}
<div class="w-full text-right">
    <SockethubButton {disabled} buttonAction={handleSubmit}>{buttonText}</SockethubButton>
</div>
