import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type CardIconStackProps = typeof __propDef.props;
export type CardIconStackEvents = typeof __propDef.events;
export type CardIconStackSlots = typeof __propDef.slots;
export default class CardIconStack extends SvelteComponentTyped<CardIconStackProps, CardIconStackEvents, CardIconStackSlots> {
}
export {};
