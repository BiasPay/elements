import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type BaseInputProps = typeof __propDef.props;
export type BaseInputEvents = typeof __propDef.events;
export type BaseInputSlots = typeof __propDef.slots;
export default class BaseInput extends SvelteComponentTyped<BaseInputProps, BaseInputEvents, BaseInputSlots> {
}
export {};
