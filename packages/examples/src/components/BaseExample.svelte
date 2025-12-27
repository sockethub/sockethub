<script lang="ts">
import Intro from "./Intro.svelte";
import Logger from "./logs/Logger.svelte";

/**
 * Base layout component for all Sockethub platform examples.
 * Provides consistent structure with title, description, content area, and logger.
 *
 * @example
 * ```svelte
 * <BaseExample title="IRC Example" description="Connect to IRC servers">
 *   <FormField label="Server" bind:value={server} />
 *   <PlatformConnection {sockethubState} {connecting} onConnect={connect} />
 * </BaseExample>
 * ```
 */
interface Props {
    /** The platform name displayed as the main heading */
    title: string;
    /** Optional description text explaining what this platform does */
    description?: string;
    /** Child content (form fields, connection components, etc.) */
    children?: import("svelte").Snippet;
}

let { title, description, children }: Props = $props();
</script>

<Intro {title}>
    <title>{title}</title>
    {#if description}
        <p class="text-lg text-gray-600 leading-relaxed">{description}</p>
    {/if}
</Intro>

<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
    <div class="bg-white shadow-sm border border-gray-200 rounded-xl p-8">
        <div class="space-y-8">
            {@render children?.()}
        </div>
    </div>
</div>

<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
    <Logger />
</div>
