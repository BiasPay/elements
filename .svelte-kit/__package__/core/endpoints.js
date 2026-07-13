const PRODUCTION_API_URL = "https://api.biaspay.com";
const PRODUCTION_FIELD_FRAME_URL = "https://field.biaspay.com";
const DEVELOPMENT_API_URL = import.meta.env.VITE_BIAS_API_URL || "https://api.bias.localhost";
const DEVELOPMENT_FIELD_FRAME_URL = import.meta.env.VITE_BIAS_FIELD_FRAME_URL || "https://field.bias.localhost";
export function resolveElementsConfig(config) {
    return {
        ...config,
        apiBaseUrl: config.apiBaseUrl ?? (import.meta.env.DEV ? DEVELOPMENT_API_URL : PRODUCTION_API_URL),
        frameUrl: config.frameUrl ??
            (import.meta.env.DEV ? DEVELOPMENT_FIELD_FRAME_URL : PRODUCTION_FIELD_FRAME_URL),
    };
}
