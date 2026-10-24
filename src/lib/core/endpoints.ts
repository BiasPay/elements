import type { CheckoutSessionExpand } from "@biaspay/sdk-checkout";
import type { ElementsConfig } from "./adapter";

declare global {
    interface ImportMetaEnv {
        DEV: boolean;
        VITE_BIAS_API_URL?: string;
        VITE_BIAS_FIELD_FRAME_URL?: string;
    }

    interface ImportMeta {
        readonly env: ImportMetaEnv;
    }
}

const PRODUCTION_API_URL = "https://api.biaspay.com";
const PRODUCTION_FIELD_FRAME_URL = "https://field.biaspay.com";

const DEVELOPMENT_API_URL = import.meta.env.VITE_BIAS_API_URL || "https://api.bias.localhost";
const DEVELOPMENT_FIELD_FRAME_URL =
    import.meta.env.VITE_BIAS_FIELD_FRAME_URL || "https://field.bias.localhost";

function expandBranch(url: string): string {
    if (!url.includes("{branch}")) return url;
    const branch = location.hostname.split(".")[0]!;
    if (!/^[a-z0-9-]{1,63}$/.test(branch)) {
        throw new Error(`Cannot derive a branch name from host ${location.hostname}.`);
    }
    return url.replace("{branch}", branch);
}

export type ResolvedElementsConfig = ElementsConfig & {
    apiBaseUrl: string;
    frameUrl: string;
    rememberDetails: boolean;
    savedPaymentMethods: readonly NonNullable<ElementsConfig["savedPaymentMethods"]>[number][];
};

export const ELEMENTS_REQUIRED_EXPAND = {
    discounts: true,
    payments: true,
} as const satisfies CheckoutSessionExpand;

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeObject(left: Record<string, unknown>, right: Record<string, unknown>) {
    const merged: Record<string, unknown> = { ...left };
    for (const [key, value] of Object.entries(right)) {
        const previous = merged[key];
        if (isRecord(previous) && isRecord(value)) merged[key] = mergeObject(previous, value);
        else if (!isRecord(previous) || value !== true) merged[key] = value;
    }
    return merged;
}

export function mergeCheckoutSessionExpand(
    configured?: CheckoutSessionExpand,
): CheckoutSessionExpand {
    return mergeObject(
        (configured ?? {}) as Record<string, unknown>,
        ELEMENTS_REQUIRED_EXPAND as unknown as Record<string, unknown>,
    ) as CheckoutSessionExpand;
}

export function structurallyEqual(left: unknown, right: unknown): boolean {
    if (left === right) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        return (
            Array.isArray(left) &&
            Array.isArray(right) &&
            left.length === right.length &&
            left.every((value, index) => structurallyEqual(value, right[index]))
        );
    }
    if (!isRecord(left) || !isRecord(right)) return false;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return (
        leftKeys.length === rightKeys.length &&
        leftKeys.every(
            (key, index) => key === rightKeys[index] && structurallyEqual(left[key], right[key]),
        )
    );
}

export function resolveElementsConfig(config: ElementsConfig): ResolvedElementsConfig {
    return {
        ...config,
        rememberDetails: config.rememberDetails ?? false,
        savedPaymentMethods: config.savedPaymentMethods ?? [],
        apiBaseUrl:
            config.apiBaseUrl ?? (import.meta.env.DEV ? DEVELOPMENT_API_URL : PRODUCTION_API_URL),
        frameUrl:
            config.frameUrl ??
            (import.meta.env.DEV
                ? expandBranch(DEVELOPMENT_FIELD_FRAME_URL)
                : PRODUCTION_FIELD_FRAME_URL),
    };
}
