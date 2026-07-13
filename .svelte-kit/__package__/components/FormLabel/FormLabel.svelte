<script lang="ts">
    import { cn } from "../../utils/classes";

    type Props = { label: string; for: string; class?: string };
    let { label, for: htmlFor, class: className }: Props = $props();
</script>

<label
    for={htmlFor}
    class={cn(
        "bias-formLabel 🔒 bias:block bias:text-sm bias:font-normal bias:pb-[0.35rem] bias:text-(--bias-color-muted-foreground)",
        className,
    )}
>{label}</label>
