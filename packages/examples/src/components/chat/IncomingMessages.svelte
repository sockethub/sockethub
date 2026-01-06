<script module lang="ts">
import type { AnyActivityStream } from "$lib/sockethub";
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
        context: m.context,
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
            context: m.context,
        });
    }
}
</script>

<div>
    <label for="incomingMessagesContainer" class="text-gray-900 font-bold">Incoming Messages</label>

    <div id="incomingMessagesContainer" class="incoming-messages-container w-full">
        <ui class="incoming-messages">
            {#each $messages as l}
                <li>{l[0]}: {l[1]}</li>
            {/each}
        </ui>
        <div class="incoming-messages-anchor"></div>
    </div>
</div>
