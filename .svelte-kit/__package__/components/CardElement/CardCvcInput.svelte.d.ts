import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type CardCvcInputProps = typeof __propDef.props;
export type CardCvcInputEvents = typeof __propDef.events;
export type CardCvcInputSlots = typeof __propDef.slots;
export default class CardCvcInput extends SvelteComponentTyped<CardCvcInputProps, CardCvcInputEvents, CardCvcInputSlots> {
}
export {};
