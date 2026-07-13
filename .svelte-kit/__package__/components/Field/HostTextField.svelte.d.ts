import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type HostTextFieldProps = typeof __propDef.props;
export type HostTextFieldEvents = typeof __propDef.events;
export type HostTextFieldSlots = typeof __propDef.slots;
export default class HostTextField extends SvelteComponentTyped<HostTextFieldProps, HostTextFieldEvents, HostTextFieldSlots> {
}
export {};
