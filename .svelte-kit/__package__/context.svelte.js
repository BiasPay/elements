import { getContext, setContext } from "svelte";
import { createSubscriber } from "svelte/reactivity";
import { BiasController as CoreBiasController, } from "./core";
const BIAS_KEY = Symbol("bias-context");
const SCOPE_KEY = Symbol("bias-address-scope");
const APPEARANCE_KEY = Symbol("bias-appearance");
/** Reactive private renderer veneer over the deliberately narrow Core adapter. */
export class BiasController {
    core;
    track;
    static fromCore(core) {
        return new BiasController({ core });
    }
    constructor(source) {
        this.core = "core" in source ? source.core : new CoreBiasController(source);
        this.track = createSubscriber((update) => this.core.subscribe(update));
    }
    get publicState() {
        this.track();
        return this.core.getPublicState();
    }
    get sessionState() {
        return this.publicState.sessionState;
    }
    get checkoutSession() {
        const state = this.sessionState;
        return "session" in state ? state.session : undefined;
    }
    get sessionLoading() {
        return this.sessionState.status === "idle" || this.sessionState.status === "loading";
    }
    get submitDisabled() {
        const status = this.publicState.status;
        return status === "submitting" || status === "succeeded";
    }
    get isSubmittable() {
        return this.publicState.canSubmit;
    }
    get sessionKey() {
        this.track();
        return this.core.getFrame("cardNumber").key;
    }
    get clientSecret() {
        this.track();
        return this.core.getFrame("cardNumber").clientSecret;
    }
    get frameUrl() {
        this.track();
        return this.core.getFrame("cardNumber").frameUrl;
    }
    get snapshot() {
        const state = this.publicState;
        return {
            selectedPaymentMethod: state.paymentMethod,
            submitLoading: state.status === "submitting",
            submitSuccess: state.status === "succeeded",
            paymentError: state.submissionError?.message ?? null,
            collectsShipping: this.hasCollector("address", "shipping"),
            collectsAddress: this.hasCollector("address", "billing"),
            billingSameAsShipping: this.getBillingSameAsShipping(),
        };
    }
    get fieldState() {
        this.track();
        const result = {};
        const fields = [
            "country",
            "postalCode",
            "accountType",
            "email",
            "name",
            "addressLine1",
            "addressLine2",
            "city",
            "state",
            "phone",
            "shippingCountry",
            "shippingPostalCode",
            "shippingName",
            "shippingAddressLine1",
            "shippingAddressLine2",
            "shippingCity",
            "shippingState",
            "shippingPhone",
        ];
        for (const name of fields) {
            const binding = this.core.getField(name);
            result[name] = {
                ...binding.state,
                focused: binding.state.isFocused,
                valid: binding.state.isValid,
            };
        }
        for (const name of [
            "cardNumber",
            "cardExpiry",
            "cardCvc",
            "bankRoutingNumber",
            "bankAccountNumber",
        ]) {
            result[name] = this.core.getFrame(name).state;
        }
        return result;
    }
    activate() {
        this.core.activate();
    }
    deactivate() {
        this.core.deactivate();
    }
    updateConfig(next) {
        this.core.updateConfig(next);
    }
    attemptPayment() {
        this.core.submit();
    }
    setPaymentMethod(method) {
        this.core.setPaymentMethod(method);
    }
    registerCollector(collector) {
        return this.core.registerCollector(collector);
    }
    registerPaymentElement(method) {
        return this.core.registerPaymentElement(method);
    }
    addressMetadata(scope) {
        this.track();
        return this.core.getAddressMetadata(scope).metadata;
    }
    getBillingSameAsShipping() {
        this.track();
        return this.core.getBillingSameAsShipping();
    }
    setBillingSameAsShipping(value) {
        this.core.setBillingSameAsShipping(value);
    }
    hasCollector(kind, scope) {
        this.track();
        return this.core.hasCollector(kind, scope);
    }
    autocompleteAddress(input, country, signal) {
        return this.core.autocompleteAddress(input, country, signal);
    }
    getField(scope, name) {
        const addressNames = [
            "country",
            "postalCode",
            "name",
            "addressLine1",
            "addressLine2",
            "city",
            "state",
            "phone",
        ];
        const publicName = scope === "shipping" && addressNames.includes(name)
            ? `shipping${name[0].toUpperCase()}${name.slice(1)}`
            : name;
        const binding = this.core.getField(publicName, scope);
        this.track();
        return {
            get value() {
                return binding.state.value;
            },
            get state() {
                return {
                    ...binding.state,
                    focused: binding.state.isFocused,
                    valid: binding.state.isValid,
                };
            },
            setValue: binding.setValue,
            setState(next) {
                if (next.focused === true)
                    binding.onFocus();
                if (next.focused === false)
                    binding.onBlur();
            },
            validate: binding.onBlur,
            setValidator: binding.setValidator,
        };
    }
}
export function createBiasContextMap(controller, scope, getAppearance) {
    const context = new Map([[BIAS_KEY, controller]]);
    if (scope)
        context.set(SCOPE_KEY, { current: scope });
    if (getAppearance) {
        context.set(APPEARANCE_KEY, {
            get current() {
                return getAppearance();
            },
        });
    }
    return context;
}
export function setBiasContext(controller) {
    setContext(BIAS_KEY, controller);
}
export function getBiasContext() {
    const controller = getContext(BIAS_KEY);
    if (!controller)
        throw new Error("Bias components must be used within <BiasProvider>");
    return controller;
}
export function setAddressScope(getScope) {
    setContext(SCOPE_KEY, {
        get current() {
            return getScope();
        },
    });
}
export function getAddressScope() {
    return getContext(SCOPE_KEY)?.current ?? "billing";
}
export function setAppearanceContext(getAppearance) {
    setContext(APPEARANCE_KEY, {
        get current() {
            return getAppearance();
        },
    });
}
export function getAppearanceContext() {
    return getContext(APPEARANCE_KEY)?.current;
}
