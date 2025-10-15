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
        <p>{description}</p>
    {/if}
</Intro>

<div class="space-y-6">
    {@render children?.()}
</div>

<Logger />