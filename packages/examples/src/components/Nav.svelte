<script>
import { base } from "$app/paths";
import { page } from "$app/stores";

const navItems = [
    ["Home", "/"],
    ["Dummy", "/dummy"],
    ["Feeds", "/feeds"],
    ["IRC", "/irc"],
    ["Metadata", "/metadata"],
    ["XMPP", "/xmpp"],
];
</script>

<nav class="flex justify-center space-x-4 p-2">
    {#each navItems as [title, path]}
        <a
            class="rounded-lg px-2 pt-1 pb-1.5 font-medium {$page.url.pathname.endsWith(path)
                ? 'bg-orange-600 text-blue-50'
                : 'text-slate-700 hover:bg-slate-300'}"
            href="{base}{path}">{title}</a
        >
    {/each}
</nav>
