import type { FullAutoFill } from "svelte/elements";
import type { AddressScope } from "~/core";

/** Keep browser-saved billing and shipping addresses in their respective scopes. */
export function scopedAutocomplete(scope: AddressScope, field: FullAutoFill): FullAutoFill {
    return `${scope} ${field}` as FullAutoFill;
}

/**
 * Browser autofill, password managers, and paste insert a completed value in one
 * event. They should not open the interactive Mapbox typeahead flow.
 */
export function isExternalAddressFill(event: Event): boolean {
    if (!(event instanceof InputEvent)) return true;

    if (
        event.inputType === "insertFromPaste" ||
        event.inputType === "insertReplacementText" ||
        event.inputType === ""
    ) {
        return true;
    }

    return event.inputType === "insertText" && (event.data === null || event.data.length > 1);
}
