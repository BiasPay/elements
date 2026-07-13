import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type FrameFieldProps = typeof __propDef.props;
export type FrameFieldEvents = typeof __propDef.events;
export type FrameFieldSlots = typeof __propDef.slots;
export default class FrameField extends SvelteComponentTyped<FrameFieldProps, FrameFieldEvents, FrameFieldSlots> {
}
export {};
