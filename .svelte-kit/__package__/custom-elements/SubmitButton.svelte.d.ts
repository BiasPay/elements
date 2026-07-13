import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type SubmitButtonProps = typeof __propDef.props;
export type SubmitButtonEvents = typeof __propDef.events;
export type SubmitButtonSlots = typeof __propDef.slots;
export default class SubmitButton extends SvelteComponentTyped<SubmitButtonProps, SubmitButtonEvents, SubmitButtonSlots> {
}
export {};
