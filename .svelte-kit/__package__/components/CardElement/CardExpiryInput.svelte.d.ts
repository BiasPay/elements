import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type CardExpiryInputProps = typeof __propDef.props;
export type CardExpiryInputEvents = typeof __propDef.events;
export type CardExpiryInputSlots = typeof __propDef.slots;
export default class CardExpiryInput extends SvelteComponentTyped<CardExpiryInputProps, CardExpiryInputEvents, CardExpiryInputSlots> {
}
export {};
