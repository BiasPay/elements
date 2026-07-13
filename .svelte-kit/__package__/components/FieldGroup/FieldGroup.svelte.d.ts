import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type FieldGroupProps = typeof __propDef.props;
export type FieldGroupEvents = typeof __propDef.events;
export type FieldGroupSlots = typeof __propDef.slots;
export default class FieldGroup extends SvelteComponentTyped<FieldGroupProps, FieldGroupEvents, FieldGroupSlots> {
}
export {};
