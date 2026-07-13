import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type FormLabelProps = typeof __propDef.props;
export type FormLabelEvents = typeof __propDef.events;
export type FormLabelSlots = typeof __propDef.slots;
export default class FormLabel extends SvelteComponentTyped<FormLabelProps, FormLabelEvents, FormLabelSlots> {
}
export {};
