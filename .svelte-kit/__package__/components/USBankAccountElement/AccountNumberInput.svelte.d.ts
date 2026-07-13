import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type AccountNumberInputProps = typeof __propDef.props;
export type AccountNumberInputEvents = typeof __propDef.events;
export type AccountNumberInputSlots = typeof __propDef.slots;
export default class AccountNumberInput extends SvelteComponentTyped<AccountNumberInputProps, AccountNumberInputEvents, AccountNumberInputSlots> {
}
export {};
