<script lang="ts">
import type { TextAreaObject } from "$lib/types";
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
    /** Shown in the editor header, e.g. "actor" or "object". */
    caption?: string;
    submitData: (text: string) => void;
}

let {
    buttonText = "Send",
    disabled,
    obj,
    title,
    caption,
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
    <div class="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-100">
        <div class="flex items-center justify-between border-b border-zinc-200 bg-white px-3 py-1.5">
            <label for="json-object-{title}" class="text-xs font-semibold text-zinc-700">{title}</label>
            <span class="font-mono text-[11px] text-zinc-400">{caption ?? "JSON"}</span>
        </div>
        <textarea
            id="json-object-{title}"
            bind:value={editedJson}
            {rows}
            spellcheck="false"
            autocapitalize="off"
            class="block w-full resize-y border-0 bg-transparent px-3 py-2.5 font-mono text-[13px] leading-relaxed text-zinc-800 focus:ring-0 focus:outline-none"
        ></textarea>
    </div>
    {#if typeof obj.password === "string"}
        <div class="space-y-1.5">
            <label for="secret-input-{slug}" class="label">Password</label>
            <input id="secret-input-{slug}" bind:value={password} type="password" class="input" />
            <p class="hint">Sent inside the credentials object, kept out of the JSON above.</p>
        </div>
    {/if}
    {#if parseError}
        <p class="callout callout-error" role="alert">{parseError}</p>
    {/if}
    <div class="flex justify-end">
        <SockethubButton {disabled} buttonAction={handleSubmit}>{buttonText}</SockethubButton>
    </div>
</div>
