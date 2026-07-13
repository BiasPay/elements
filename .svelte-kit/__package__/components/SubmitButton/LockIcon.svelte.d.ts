import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type LockIconProps = typeof __propDef.props;
export type LockIconEvents = typeof __propDef.events;
export type LockIconSlots = typeof __propDef.slots;
export default class LockIcon extends SvelteComponentTyped<LockIconProps, LockIconEvents, LockIconSlots> {
}
export {};
