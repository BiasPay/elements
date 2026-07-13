import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type PaymentElementProps = typeof __propDef.props;
export type PaymentElementEvents = typeof __propDef.events;
export type PaymentElementSlots = typeof __propDef.slots;
export default class PaymentElement extends SvelteComponentTyped<PaymentElementProps, PaymentElementEvents, PaymentElementSlots> {
}
export {};
