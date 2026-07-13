import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type FormErrorProps = typeof __propDef.props;
export type FormErrorEvents = typeof __propDef.events;
export type FormErrorSlots = typeof __propDef.slots;
export default class FormError extends SvelteComponentTyped<FormErrorProps, FormErrorEvents, FormErrorSlots> {
}
export {};
