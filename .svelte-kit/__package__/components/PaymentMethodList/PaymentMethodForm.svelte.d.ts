import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type PaymentMethodFormProps = typeof __propDef.props;
export type PaymentMethodFormEvents = typeof __propDef.events;
export type PaymentMethodFormSlots = typeof __propDef.slots;
export default class PaymentMethodForm extends SvelteComponentTyped<PaymentMethodFormProps, PaymentMethodFormEvents, PaymentMethodFormSlots> {
}
export {};
