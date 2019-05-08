// declare functions for d3

declare module "d3" {
	declare function select<T>(node: string): T;
 	declare function datum<T>(Array<T>): T[];
	declare function call<T>(fn: Array<T>): T[];
 	declare function json<T>(node: string, fn: T): T[];
}
