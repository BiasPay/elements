import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type FieldFrameProps = typeof __propDef.props;
export type FieldFrameEvents = typeof __propDef.events;
export type FieldFrameSlots = typeof __propDef.slots;
export default class FieldFrame extends SvelteComponentTyped<FieldFrameProps, FieldFrameEvents, FieldFrameSlots> {
}
export {};
