import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type PaymentMethodTabListProps = typeof __propDef.props;
export type PaymentMethodTabListEvents = typeof __propDef.events;
export type PaymentMethodTabListSlots = typeof __propDef.slots;
export default class PaymentMethodTabList extends SvelteComponentTyped<PaymentMethodTabListProps, PaymentMethodTabListEvents, PaymentMethodTabListSlots> {
}
export {};
