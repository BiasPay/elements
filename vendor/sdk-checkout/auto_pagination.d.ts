import type { RequestConfig } from "./types";
import type { List } from "./utility_types";
export declare function iterateListPages<
	TParams,
	TResult extends List<any> | {
		object: "error";
	}
>(resource: (params: TParams, config?: RequestConfig) => Promise<TResult>, params: TParams, config?: Omit<RequestConfig, "idempotencyKey">): AsyncGenerator<TResult, TResult, unknown>;
export declare function fetchListPages<
	TParams,
	TResult extends List<any> | {
		object: "error";
	}
>(resource: (params: TParams, config?: RequestConfig) => Promise<TResult>, params: TParams, config: Omit<RequestConfig, "idempotencyKey"> & {
	maxItems?: number;
}): Promise<TResult>;
