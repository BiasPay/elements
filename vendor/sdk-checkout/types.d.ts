export type Config = {
	fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
	baseURL?: string;
	networkRetries?: number;
	/**
	* Maximum request duration, in milliseconds.
	* An error will be thrown if the request takes longer than `timeout`
	* @default 30_000 // 30 seconds
	**/
	timeout?: number;
	/**
	* Additional headers to include in each request
	*/
	headers?: Record<string, string>;
};
export type InstanceConfig = Config & {
	apiKey: string;
};
export type RequestConfig = Partial<Config> & {
	idempotencyKey?: string;
	/**
	* An AbortSignal that can be used to cancel the request.
	*/
	signal?: AbortSignal;
	/**
	* Whether an event stream reconnects after it drops, catching up on the events it missed.
	* @default true
	*/
	reconnect?: boolean;
};
export type Resource = {
	path: string;
	method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
	params: {
		path: string[];
		query: string[];
		body: string[];
	};
	contentType?: "application/json" | "multipart/form-data";
	maxLimit?: number;
	config: InstanceConfig;
};
export type IsExpandable<T> = string extends T ? Exclude<T, string | null> extends never ? false : Exclude<T, string | null> extends object ? true : false : false;
export type AssertExpandable<T> = IsExpandable<T> extends true ? T : "The type provided is not expandable. Is this field expandable and not `| undefined`?";
export type ExpandableKeys<T> = Extract<{ [K in keyof T]: IsExpandable<T[K]> extends true ? K : never }[keyof T], string>;
export type NonError<T> = Exclude<T, {
	object: "error";
}>;
export type AllOptional<T> = Record<string, never> extends T ? true : false;
export type StrictEquals<
	A,
	B
> = (A extends B ? (B extends A ? true : false) : false) extends true ? true : false;
export type Exact<
	T,
	U
> = T & Record<Exclude<keyof T, keyof U>, never>;
