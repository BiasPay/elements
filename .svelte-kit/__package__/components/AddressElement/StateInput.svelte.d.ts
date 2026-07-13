import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type StateInputProps = typeof __propDef.props;
export type StateInputEvents = typeof __propDef.events;
export type StateInputSlots = typeof __propDef.slots;
export default class StateInput extends SvelteComponentTyped<StateInputProps, StateInputEvents, StateInputSlots> {
}
export {};
