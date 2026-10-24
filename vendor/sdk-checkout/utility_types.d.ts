export type List<T> = {
	object: "list";
	items: T[];
	has_more: boolean;
};
