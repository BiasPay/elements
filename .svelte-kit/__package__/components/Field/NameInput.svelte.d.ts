import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type NameInputProps = typeof __propDef.props;
export type NameInputEvents = typeof __propDef.events;
export type NameInputSlots = typeof __propDef.slots;
export default class NameInput extends SvelteComponentTyped<NameInputProps, NameInputEvents, NameInputSlots> {
}
export {};
