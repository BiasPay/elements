import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type CardIconProps = typeof __propDef.props;
export type CardIconEvents = typeof __propDef.events;
export type CardIconSlots = typeof __propDef.slots;
export default class CardIcon extends SvelteComponentTyped<CardIconProps, CardIconEvents, CardIconSlots> {
}
export {};
