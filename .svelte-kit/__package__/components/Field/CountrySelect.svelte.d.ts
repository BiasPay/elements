import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type CountrySelectProps = typeof __propDef.props;
export type CountrySelectEvents = typeof __propDef.events;
export type CountrySelectSlots = typeof __propDef.slots;
export default class CountrySelect extends SvelteComponentTyped<CountrySelectProps, CountrySelectEvents, CountrySelectSlots> {
}
export {};
