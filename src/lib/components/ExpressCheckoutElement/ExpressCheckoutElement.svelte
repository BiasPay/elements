<script lang="ts">
    import type { Appearance } from "~/core";
    import { appearance as appearanceAction } from "~/utils/appearance";
    import ApplePayButton from "../ApplePay/ApplePayButton.svelte";

    type Props = {
        disabled?: boolean;
        showSeparator?: boolean;
        appearance?: Appearance;
    };

    let { disabled = false, showSeparator = false, appearance }: Props = $props();
</script>

<div
    class="bias-expressCheckoutElement 🔒 bias:min-w-60 bias:w-full"
    use:appearanceAction={appearance}
>
    <ApplePayButton {disabled} {showSeparator} />
</div>
