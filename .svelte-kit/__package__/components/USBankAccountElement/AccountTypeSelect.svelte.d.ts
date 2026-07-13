import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type AccountTypeSelectProps = typeof __propDef.props;
export type AccountTypeSelectEvents = typeof __propDef.events;
export type AccountTypeSelectSlots = typeof __propDef.slots;
export default class AccountTypeSelect extends SvelteComponentTyped<AccountTypeSelectProps, AccountTypeSelectEvents, AccountTypeSelectSlots> {
}
export {};
