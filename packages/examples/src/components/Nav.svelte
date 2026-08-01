<script>
import { base } from "$app/paths";
import { page } from "$app/stores";

const navItems = [
    ["🏠", "Home", "/", "Start here to understand Sockethub"],
    ["🔧", "Dummy", "/dummy", "Basic examples • Start here"],
    ["📰", "Feeds", "/feeds", "RSS/ATOM feed parsing"],
    ["🔍", "Metadata", "/metadata", "Web page metadata extraction"],
    ["📅", "CalDAV", "/caldav", "Calendars and tasks"],
    ["💬", "IRC", "/irc", "Internet Relay Chat • Advanced"],
    ["📨", "XMPP", "/xmpp", "Extensible messaging • Advanced"],
];
</script>

<nav class="flex justify-center flex-wrap gap-2 p-2">
    {#each navItems as [icon, title, path, description]}
        <a
            class="group relative rounded-lg px-3 py-2 font-medium transition-all duration-200 no-underline {$page.url.pathname.endsWith(path)
                ? 'bg-orange-600 text-blue-50 shadow-md'
                : 'text-slate-700 hover:bg-slate-200 hover:shadow-sm'}"
            href="{base}{path}"
            title={description}
        >
            <span class="text-sm">{icon}</span>
            <span class="ml-1">{title}</span>
            
            <!-- Tooltip on hover -->
            <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                {description}
                <div class="absolute top-full left-1/2 transform -translate-x-1/2 border-2 border-transparent border-t-gray-800"></div>
            </div>
        </a>
    {/each}
</nav>
