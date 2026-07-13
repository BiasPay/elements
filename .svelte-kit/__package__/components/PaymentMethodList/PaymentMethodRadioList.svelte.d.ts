import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type PaymentMethodRadioListProps = typeof __propDef.props;
export type PaymentMethodRadioListEvents = typeof __propDef.events;
export type PaymentMethodRadioListSlots = typeof __propDef.slots;
export default class PaymentMethodRadioList extends SvelteComponentTyped<PaymentMethodRadioListProps, PaymentMethodRadioListEvents, PaymentMethodRadioListSlots> {
}
export {};
