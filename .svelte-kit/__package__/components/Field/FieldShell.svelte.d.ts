import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type FieldShellProps = typeof __propDef.props;
export type FieldShellEvents = typeof __propDef.events;
export type FieldShellSlots = typeof __propDef.slots;
export default class FieldShell extends SvelteComponentTyped<FieldShellProps, FieldShellEvents, FieldShellSlots> {
}
export {};
