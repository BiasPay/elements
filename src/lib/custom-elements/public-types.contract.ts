import type { BiasProviderConfiguration } from "./public-types";

type Assert<T extends true> = T;
type FrameUrlKeys = Extract<keyof BiasProviderConfiguration, "frameUrl">;
type HasApiBaseUrl = "apiBaseUrl" extends keyof BiasProviderConfiguration ? true : false;

export type SecureFrameUrlIsBuildTimeOnly = Assert<FrameUrlKeys extends never ? true : false>;
export type ApiBaseUrlCanUseSameOriginProxy = Assert<HasApiBaseUrl>;
