import { BiasController, themeVariableStyle, } from "../core";
import { registerProvider, unregisterProvider } from "./registry";
const HTMLElementBase = typeof HTMLElement === "undefined" ? class {
} : HTMLElement;
export class BiasProviderElement extends HTMLElementBase {
    static observedAttributes = ["client-secret"];
    core;
    ownsController = true;
    unsubscribe;
    appearanceListeners = new Set();
    appliedVariables = new Set();
    lastStatus;
    lastError;
    _initialCheckoutSession;
    _appearance;
    _onComplete;
    get controller() {
        return this.core;
    }
    set controller(value) {
        if (this.core === value)
            return;
        this.detachController();
        this.core = value;
        this.ownsController = !value;
        if (this.isConnected)
            this.attachController();
    }
    get clientSecret() {
        return this.getAttribute("client-secret") ?? "";
    }
    set clientSecret(value) {
        this.setStringAttribute("client-secret", value);
    }
    get initialCheckoutSession() {
        return this._initialCheckoutSession;
    }
    set initialCheckoutSession(value) {
        this._initialCheckoutSession = value;
        this.updateOwnedConfig();
    }
    get appearance() {
        return this._appearance;
    }
    set appearance(value) {
        if (this._appearance === value)
            return;
        this._appearance = value;
        this.applyAppearance();
        this.updateOwnedConfig();
        for (const listener of this.appearanceListeners)
            listener();
    }
    get onComplete() {
        return this._onComplete;
    }
    set onComplete(value) {
        this._onComplete = value;
        this.updateOwnedConfig();
    }
    get sessionState() {
        return this.requireController().getPublicState().sessionState;
    }
    get paymentMethod() {
        return this.requireController().getPublicState().paymentMethod;
    }
    get status() {
        return this.requireController().getPublicState().status;
    }
    get canSubmit() {
        return this.requireController().getPublicState().canSubmit;
    }
    get submissionError() {
        return this.requireController().getPublicState().submissionError;
    }
    connectedCallback() {
        this.classList.add("bias-provider");
        this.setAttribute("data-bias-loading", "");
        this.attachController();
        this.applyAppearance();
    }
    disconnectedCallback() {
        this.detachController();
    }
    attributeChangedCallback() {
        if (this.isConnected && !this.core && this.clientSecret)
            this.attachController();
        else
            this.updateOwnedConfig();
    }
    submit() {
        this.requireController().submit();
    }
    refreshSession() {
        this.requireController().refreshSession();
    }
    setPaymentMethod(method) {
        this.requireController().setPaymentMethod(method);
    }
    getField(name, options) {
        const field = this.requireController().getField(name);
        if (options?.validate)
            field.setValidator(options.validate);
        return field;
    }
    config() {
        return {
            clientSecret: this.clientSecret,
            initialCheckoutSession: this._initialCheckoutSession,
            appearance: this._appearance,
            onComplete: () => this._onComplete?.(),
        };
    }
    attachController() {
        if (!this.core) {
            if (!this.clientSecret)
                return;
            this.core = new BiasController(this.config());
            this.ownsController = true;
        }
        registerProvider(this, {
            controller: this.core,
            getAppearance: () => this._appearance,
            subscribeAppearance: (listener) => {
                this.appearanceListeners.add(listener);
                return () => this.appearanceListeners.delete(listener);
            },
        });
        this.unsubscribe = this.core.subscribe(() => this.handleStateChange());
        if (this.ownsController)
            this.core.activate();
        this.handleStateChange();
        this.dispatchEvent(new CustomEvent("biasready", { bubbles: true }));
    }
    detachController() {
        unregisterProvider(this);
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        if (this.ownsController)
            this.core?.deactivate();
        if (this.ownsController)
            this.core = undefined;
        this.lastStatus = undefined;
        this.lastError = undefined;
    }
    updateOwnedConfig() {
        if (this.ownsController && this.core)
            this.core.updateConfig(this.config());
    }
    handleStateChange() {
        if (!this.core)
            return;
        const state = this.core.getPublicState();
        const session = state.sessionState;
        const visible = (session.status !== "idle" && session.status !== "loading") || "session" in session;
        this.toggleAttribute("data-bias-loading", !visible);
        this.dispatchEvent(new CustomEvent("biaschange", { detail: state, bubbles: true }));
        if (state.status === "succeeded" && this.lastStatus !== "succeeded") {
            this.dispatchEvent(new CustomEvent("biascomplete", { detail: state, bubbles: true }));
        }
        const error = state.submissionError ?? (session.status === "error" ? session.error : null);
        if (error && error !== this.lastError) {
            this.dispatchEvent(new CustomEvent("biaserror", { detail: error, bubbles: true }));
        }
        this.lastStatus = state.status;
        this.lastError = error;
    }
    applyAppearance() {
        const next = themeVariableStyle(this._appearance?.variables);
        for (const name of this.appliedVariables) {
            if (!(name in next))
                this.style.removeProperty(name);
        }
        for (const [name, value] of Object.entries(next))
            this.style.setProperty(name, value);
        this.appliedVariables = new Set(Object.keys(next));
    }
    requireController() {
        if (!this.core)
            throw new Error("Bias Elements: <bias-provider> is not configured.");
        return this.core;
    }
    setStringAttribute(name, value) {
        if (value === undefined || value === "")
            this.removeAttribute(name);
        else
            this.setAttribute(name, value);
    }
}
