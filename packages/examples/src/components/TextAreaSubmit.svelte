<script lang="ts">
import TextBox from "$components/TextBox.svelte";
import type { TextAreaObject } from "$lib/types";
import { createEventDispatcher } from "svelte";
import SockethubButton from "./SockethubButton.svelte";

interface Props {
    buttonText?: string;
    disabled: boolean;
    obj: TextAreaObject;
    title: string;
}

let {
    buttonText = "Send",
    disabled,
    obj = $bindable(),
    title,
}: Props = $props();

let password = $state("unset");

const dispatcher = createEventDispatcher();

if (obj.password) {
    password = obj.password;
    obj.password = undefined;
}

const objString = $derived(JSON.stringify(obj, null, 3));

async function handleSubmit(): Promise<void> {
    console.log("PASSWORD: ", password);
    if (password !== "unset") {
        obj.password = password;
    }

    dispatcher("submit", {
        jsonString: JSON.stringify(obj),
    });
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
