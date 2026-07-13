import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type CardNumberInputProps = typeof __propDef.props;
export type CardNumberInputEvents = typeof __propDef.events;
export type CardNumberInputSlots = typeof __propDef.slots;
export default class CardNumberInput extends SvelteComponentTyped<CardNumberInputProps, CardNumberInputEvents, CardNumberInputSlots> {
}
export {};
