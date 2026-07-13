import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type AddressElementProps = typeof __propDef.props;
export type AddressElementEvents = typeof __propDef.events;
export type AddressElementSlots = typeof __propDef.slots;
export default class AddressElement extends SvelteComponentTyped<AddressElementProps, AddressElementEvents, AddressElementSlots> {
}
export {};
