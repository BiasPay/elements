import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type PaymentMethodRadioOptionProps = typeof __propDef.props;
export type PaymentMethodRadioOptionEvents = typeof __propDef.events;
export type PaymentMethodRadioOptionSlots = typeof __propDef.slots;
export default class PaymentMethodRadioOption extends SvelteComponentTyped<PaymentMethodRadioOptionProps, PaymentMethodRadioOptionEvents, PaymentMethodRadioOptionSlots> {
}
export {};
