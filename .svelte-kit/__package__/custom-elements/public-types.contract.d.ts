import type { BiasProviderConfiguration } from "./public-types";
type Assert<T extends true> = T;
type ServiceUrlKeys = Extract<keyof BiasProviderConfiguration, "apiBaseUrl" | "frameUrl">;
export type ServiceUrlsAreBuildTimeOnly = Assert<ServiceUrlKeys extends never ? true : false>;
export {};
