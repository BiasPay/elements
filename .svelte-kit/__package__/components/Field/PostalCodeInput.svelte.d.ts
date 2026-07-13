import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type PostalCodeInputProps = typeof __propDef.props;
export type PostalCodeInputEvents = typeof __propDef.events;
export type PostalCodeInputSlots = typeof __propDef.slots;
export default class PostalCodeInput extends SvelteComponentTyped<PostalCodeInputProps, PostalCodeInputEvents, PostalCodeInputSlots> {
}
export {};
