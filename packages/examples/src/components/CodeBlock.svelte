<script lang="ts">
import hljs from "highlight.js/lib/core";
import jsonLanguage from "highlight.js/lib/languages/json";

hljs.registerLanguage("json", jsonLanguage);

/**
 * Read-only, highlighted JSON. Each line keeps its indentation when it
 * wraps on a narrow screen: continuation lines hang two characters in from
 * where the line started, instead of falling back to column 0.
 */
interface Props {
    code: string;
    class?: string;
}

let { code, class: className = "" }: Props = $props();

// JSON tokens never span lines, so the highlighted HTML splits safely on \n.
const lines = $derived(
    hljs
        .highlight(code, { language: "json" })
        .value.split("\n")
        .map((html) => {
            const indent = html.match(/^ */)?.[0].length ?? 0;
            // Offer line breaks after "/" in strings so URLs wrap at path
            // boundaries before the browser resorts to breaking mid-word.
            const body = html
                .slice(indent)
                .replace(
                    /(<span class="hljs-string">)(.*?)(<\/span>)/g,
                    (_m, open, text, close) =>
                        `${open}${text.replaceAll("/", "/<wbr>")}${close}`,
                );
            return { indent, html: body };
        }),
);
</script>

<pre class="hljs code-lines {className}"><code>{#each lines as line, i (i)}<span class="code-line" style="--indent: {line.indent}">{@html line.html || " "}</span>{/each}</code></pre>
