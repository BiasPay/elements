import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type AddressInputProps = typeof __propDef.props;
export type AddressInputEvents = typeof __propDef.events;
export type AddressInputSlots = typeof __propDef.slots;
export default class AddressInput extends SvelteComponentTyped<AddressInputProps, AddressInputEvents, AddressInputSlots> {
}
export {};
