import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type PaymentMethodListProps = typeof __propDef.props;
export type PaymentMethodListEvents = typeof __propDef.events;
export type PaymentMethodListSlots = typeof __propDef.slots;
export default class PaymentMethodList extends SvelteComponentTyped<PaymentMethodListProps, PaymentMethodListEvents, PaymentMethodListSlots> {
}
export {};
