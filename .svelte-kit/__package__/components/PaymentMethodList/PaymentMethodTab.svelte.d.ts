import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type PaymentMethodTabProps = typeof __propDef.props;
export type PaymentMethodTabEvents = typeof __propDef.events;
export type PaymentMethodTabSlots = typeof __propDef.slots;
export default class PaymentMethodTab extends SvelteComponentTyped<PaymentMethodTabProps, PaymentMethodTabEvents, PaymentMethodTabSlots> {
}
export {};
