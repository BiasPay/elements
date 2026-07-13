import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type CardElementProps = typeof __propDef.props;
export type CardElementEvents = typeof __propDef.events;
export type CardElementSlots = typeof __propDef.slots;
export default class CardElement extends SvelteComponentTyped<CardElementProps, CardElementEvents, CardElementSlots> {
}
export {};
