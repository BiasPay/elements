import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type AddressAutocompleteProps = typeof __propDef.props;
export type AddressAutocompleteEvents = typeof __propDef.events;
export type AddressAutocompleteSlots = typeof __propDef.slots;
export default class AddressAutocomplete extends SvelteComponentTyped<AddressAutocompleteProps, AddressAutocompleteEvents, AddressAutocompleteSlots> {
}
export {};
