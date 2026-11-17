<script module lang="ts">
import type { AnyActivityStream } from "$lib/sockethub";
import { platformIdFromContext } from "$lib/sockethub";
import { get, writable } from "svelte/store";

const messages = writable([] as [string, string | undefined][]);

// Store recent messages to avoid duplicates across response/incoming message events
const recentMessages = new Map<string, number>();

/**
 * Displays chat messages with deduplication handling.
 *
 * Called from two places:
 * 1. Response handler (isResponse=true): When you send a message and get confirmation
 * 2. Incoming message handler (isResponse=false): When messages arrive from server
 *
 * Different chat platforms behave differently:
 * - IRC: Often echoes your own messages back, causing duplicates
 * - XMPP: May only show messages via responses or incoming, not both
 *
 * Limitations of current deduplication:
 * - Only deduplicates based on actor+content within 2 seconds
 * - Won't handle identical messages from different users
 * - Won't handle the same message sent multiple times legitimately
 * - Relies on consistent actor naming across response/incoming events
 */
export function displayMessage(m: AnyActivityStream, isResponse = false) {
    console.log("displayMessage called:", {
        type: m.type,
        platform: platformIdFromContext(m["@context"]),
        isResponse,
        actor: m.actor,
        content: m.object?.content,
    });

    // Only process send-type messages with message content
    if (m.type === "send" && m.object?.type === "message") {
        const actorName =
            typeof m.actor === "string" ? m.actor : m.actor?.name || "";
        const content = m.object.content || "";

        // Create a unique key for deduplication
        const messageKey = `${actorName}:${content}`;
        const now = Date.now();

        // Skip if we've seen this exact message recently (within 2 seconds)
        const lastSeen = recentMessages.get(messageKey);
        if (lastSeen && now - lastSeen < 2000) {
            console.log("Skipping duplicate message:", messageKey);
            return;
        }

        // Record this message timestamp
        recentMessages.set(messageKey, now);

        // Clean up old entries to prevent memory leaks
        for (const [key, timestamp] of recentMessages) {
            if (now - timestamp > 5000) {
                recentMessages.delete(key);
            }
        }

        // Add message to display list
        messages.set([...get(messages), [actorName, content]]);

        console.log("Message displayed:", {
            actorName,
            content,
            isResponse,
            platform: platformIdFromContext(m["@context"]),
        });
    }
}
</script>

<div>
    <h3 id="incoming-messages-label" class="sr-only">Messages</h3>
    <div
        id="incomingMessagesContainer"
        class="h-72 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 [overflow-anchor:none]"
        aria-labelledby="incoming-messages-label"
        aria-live="polite"
    >
        {#if $messages.length === 0}
            <div class="flex h-full flex-col items-center justify-center px-6 text-center">
                <p class="text-sm font-medium text-zinc-600">No messages yet</p>
                <p class="mt-1 text-[13px] text-zinc-400">Messages in the room, including yours, show up here.</p>
            </div>
        {:else}
            <ul class="space-y-2 p-3">
                {#each $messages as [name, content], i (i)}
                    <li class="text-sm leading-relaxed">
                        <span class="font-semibold text-zinc-900">{name}</span>
                        <span class="text-zinc-700">{content}</span>
                    </li>
                {/each}
            </ul>
        {/if}
        <div class="h-px [overflow-anchor:auto]"></div>
    </div>
</div>
