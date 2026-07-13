<script lang="ts">
    import type { Snippet } from "svelte";

    type Props = { children: Snippet };

    let { children }: Props = $props();
</script>

<div class="bias-row 🔒 bias:grid bias:grid-flow-col bias:auto-cols-fr bias:gap-3">
    {@render children()}
</div>
