import { type Error as ApiError, resources } from "./generated";
import type { AssertExpandable, InstanceConfig } from "./types";
export * from "./auto_pagination";
export type { Expanded } from "./expands";
export type * from "./generated";
export type * from "./types";
export type { List } from "./utility_types";
export declare class BiasError extends Error {
	response?: ApiError;
	constructor(message: string, response?: ApiError);
}
type Resources = ReturnType<typeof resources>;
export interface Bias extends Resources {}
export declare const Bias: {
	new (options: InstanceConfig): Bias;
};
export declare function assertExpanded<T>(value: AssertExpandable<T>): Exclude<T, string>;
export declare function getId(field: string | {
	id: string;
}): string;
