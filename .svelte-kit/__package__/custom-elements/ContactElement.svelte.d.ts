import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type ContactElementProps = typeof __propDef.props;
export type ContactElementEvents = typeof __propDef.events;
export type ContactElementSlots = typeof __propDef.slots;
export default class ContactElement extends SvelteComponentTyped<ContactElementProps, ContactElementEvents, ContactElementSlots> {
}
export {};
