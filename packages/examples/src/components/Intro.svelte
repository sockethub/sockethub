<script lang="ts">
import ContentArea from "./ContentArea.svelte";

interface Props {
    title: string;
    children?: import("svelte").Snippet;
}

let { children, title }: Props = $props();
</script>

<ContentArea>
    <div class="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-gray-200">
            <h1 class="text-3xl font-bold text-gray-900 tracking-tight">{title}</h1>
        </div>
        <div class="px-8 py-6">
            {@render children?.()}
        </div>
    </div>
</ContentArea>
