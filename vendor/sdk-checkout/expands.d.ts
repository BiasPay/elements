/**
* Extracts keys from an expand object where the value is `true` or an object (nested expand).
* @example
* TrueKeys<{ prices: true, metadata: false }> // "prices"
* TrueKeys<{ prices: { product: true } }> // "prices"
*/
type TrueKeys<T> = { [K in keyof T]: T[K] extends true | object ? K : never }[keyof T];
/**
* Extracts the object type from a field, handling both arrays and single values.
* Removes the `string` union from expandable fields like `string | Product` or `(string | Product)[]`.
* @example
* ExtractObject<string | Product> // Product
* ExtractObject<(string | Product)[]> // Product[]
*/
type ExtractObject<T> = T extends (infer U)[] ? Extract<U, object>[] : Extract<T, object>;
/**
* Conditionally adds `| null` to a type if the original type was nullable.
* Arrays are never nullable when expanded (null means "not loaded", expanded means "loaded").
* @example
* WithNullable<Product, string | Product | null> // Product | null
* WithNullable<Product, string | Product> // Product
* WithNullable<Product[], (string | Product)[] | null> // Product[] (not null)
*/
type WithNullable<
	T,
	Original
> = T extends any[] ? T : null extends Original ? T | null : T;
/**
* Transforms a field type based on its expand parameter.
* - If `Expand` is `true`: Extracts the object from the string union
* - If `Expand` is an object: Recursively applies nested expands
* Preserves nullability and array types from the original field.
* @example
* ExpandField<string | Product | null, true> // Product | null
* ExpandField<(string | Price)[], { product: true }> // Expanded<Price, { product: true }>[]
*/
type ExpandField<
	T,
	Expand
> = Expand extends true ? WithNullable<ExtractObject<Exclude<T, null>>, T> : Expand extends object ? WithNullable<Exclude<T, null> extends (infer U)[] ? Expanded<Extract<U, object>, Expand>[] : Expanded<Extract<Exclude<T, null>, object>, Expand>, T> : never;
/**
* Applies expand transformations to a type, replacing expandable fields with their expanded types.
* Supports nested expands by recursively applying the transformation.
* @example
* type Result = Expanded<Product, { prices: true, default_price: { product: true } }>;
* // prices: Price[] (instead of (string | Price)[])
* // default_price: { product: Product } (instead of { product: string | Product })
*/
export type Expanded<
	T,
	P
> = Omit<T, TrueKeys<P> & string> & { [K in keyof P & string as P[K] extends true | object ? K : never]: ExpandField<T[K & keyof T], P[K]> };
export {};
