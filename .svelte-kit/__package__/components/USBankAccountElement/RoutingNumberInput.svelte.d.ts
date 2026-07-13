import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type RoutingNumberInputProps = typeof __propDef.props;
export type RoutingNumberInputEvents = typeof __propDef.events;
export type RoutingNumberInputSlots = typeof __propDef.slots;
export default class RoutingNumberInput extends SvelteComponentTyped<RoutingNumberInputProps, RoutingNumberInputEvents, RoutingNumberInputSlots> {
}
export {};
