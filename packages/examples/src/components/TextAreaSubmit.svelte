<script lang="ts">
import type { TextAreaObject } from "$lib/types";
import Icon from "./Icon.svelte";
import SockethubButton from "./SockethubButton.svelte";

/**
 * Editable JSON payload with a submit button. A `password` property is pulled
 * out into its own masked field so it never shows in the JSON.
 */
interface Props {
    buttonText?: string;
    disabled: boolean;
    obj: TextAreaObject;
    title: string;
    /** True once submitted; shows `doneText` in place of the button. */
    done?: boolean;
    doneText?: string;
    submitData: (text: string) => void;
}

let {
    buttonText = "Send",
    disabled,
    obj,
    title,
    done = false,
    doneText,
    submitData,
}: Props = $props();

let password = $state("");
let editedJson = $state("");
let parseError = $state("");

const slug = $derived(title.toLowerCase().replace(/\s+/g, "-"));
const rows = $derived(Math.max(3, editedJson.split("\n").length));

$effect(() => {
    password = typeof obj.password === "string" ? obj.password : "";
});

$effect(() => {
    const redacted = { ...obj };
    delete redacted.password;
    editedJson = JSON.stringify(redacted, null, 2);
});

async function handleSubmit(): Promise<void> {
    let payload: TextAreaObject;
    parseError = "";
    try {
        payload = JSON.parse(editedJson) as TextAreaObject;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        parseError = `Invalid JSON: ${message}`;
        throw new Error(parseError);
    }
    if (password.length > 0) {
        payload.password = password;
    }
    submitData(JSON.stringify(payload));
}
</script>

<div class="space-y-4">
    {#if typeof obj.password === "string"}
        <div class="space-y-1.5">
            <label for="secret-input-{slug}" class="label">Password</label>
            <input id="secret-input-{slug}" bind:value={password} type="password" class="input" autocomplete="off" />
            <p class="hint">Added to the credentials object when sent, so it stays out of the JSON below.</p>
        </div>
    {/if}
    <div class="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-100">
        <div class="flex items-center justify-between border-b border-zinc-200 bg-white px-3 py-1.5">
            <label for="json-object-{title}" class="text-xs font-semibold text-zinc-700">{title}</label>
            <span class="flex items-center gap-1 text-[11px] text-zinc-500"><Icon name="pencil" class="size-3" /> editable JSON</span>
        </div>
        <textarea
            id="json-object-{title}"
            bind:value={editedJson}
            {rows}
            spellcheck="false"
            autocapitalize="off"
            class="block w-full resize-none border-0 bg-transparent px-3 py-2.5 font-mono text-[13px] leading-relaxed text-zinc-800 [field-sizing:content] focus:ring-0 focus:outline-none"
        ></textarea>
    </div>
    {#if parseError}
        <p class="callout callout-error" role="alert">{parseError}</p>
    {/if}
    <div class="flex justify-end">
        {#if doneText && done}
            <p class="flex items-center gap-1.5 py-2.5 text-sm font-medium text-emerald-700">
                <Icon name="check" class="size-4" strokeWidth={2.25} />
                {doneText}
            </p>
        {:else}
            <SockethubButton {disabled} buttonAction={handleSubmit}>{buttonText}</SockethubButton>
        {/if}
    </div>
</div>
