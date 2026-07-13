import type { CheckoutSession } from "@biaspay/sdk";
import {
    BiasController,
    themeVariableStyle,
    type Appearance,
    type BiasElementsState,
    type BiasFieldName,
    type BiasFieldState,
    type BiasFieldValidator,
    type BiasFieldValueMap,
    type ElementsConfig,
    type ElementsController,
    type PaymentMethod,
} from "~/core";
import { registerProvider, unregisterProvider } from "./registry";

export type BiasFieldBinding<K extends BiasFieldName> = {
    readonly state: BiasFieldState<BiasFieldValueMap[K]>;
    setValue(value: BiasFieldValueMap[K]): void;
    setValidator(validator: BiasFieldValidator<K>): () => void;
    validate(): void;
    onFocus(): void;
    onBlur(): void;
};

const HTMLElementBase =
    typeof HTMLElement === "undefined" ? (class {} as typeof HTMLElement) : HTMLElement;

export class BiasProviderElement extends HTMLElementBase {
    static readonly observedAttributes = ["client-secret"];

    private core: ElementsController | undefined;
    private ownsController = true;
    private unsubscribe: (() => void) | undefined;
    private appearanceListeners = new Set<() => void>();
    private appliedVariables = new Set<string>();
    private lastStatus: BiasElementsState["status"] | undefined;
    private lastError: unknown;
    private _initialCheckoutSession: CheckoutSession | undefined;
    private _appearance: Appearance | undefined;
    private _onComplete: (() => void) | undefined;

    get controller(): ElementsController | undefined {
        return this.core;
    }

    set controller(value: ElementsController | undefined) {
        if (this.core === value) return;
        this.detachController();
        this.core = value;
        this.ownsController = !value;
        if (this.isConnected) this.attachController();
    }

    get clientSecret(): string {
        return this.getAttribute("client-secret") ?? "";
    }
    set clientSecret(value: string) {
        this.setStringAttribute("client-secret", value);
    }

    get initialCheckoutSession(): CheckoutSession | undefined {
        return this._initialCheckoutSession;
    }
    set initialCheckoutSession(value: CheckoutSession | undefined) {
        this._initialCheckoutSession = value;
        this.updateOwnedConfig();
    }

    get appearance(): Appearance | undefined {
        return this._appearance;
    }
    set appearance(value: Appearance | undefined) {
        if (this._appearance === value) return;
        this._appearance = value;
        this.applyAppearance();
        this.updateOwnedConfig();
        for (const listener of this.appearanceListeners) listener();
    }

    get onComplete(): (() => void) | undefined {
        return this._onComplete;
    }
    set onComplete(value: (() => void) | undefined) {
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

    connectedCallback(): void {
        this.classList.add("bias-provider");
        this.setAttribute("data-bias-loading", "");
        this.attachController();
        this.applyAppearance();
    }

    disconnectedCallback(): void {
        this.detachController();
    }

    attributeChangedCallback(): void {
        if (this.isConnected && !this.core && this.clientSecret) this.attachController();
        else this.updateOwnedConfig();
    }

    submit(): void {
        this.requireController().submit();
    }

    refreshSession(): void {
        this.requireController().refreshSession();
    }

    setPaymentMethod(method: PaymentMethod): void {
        this.requireController().setPaymentMethod(method);
    }

    getField<K extends BiasFieldName>(
        name: K,
        options?: { validate?: BiasFieldValidator<K> },
    ): BiasFieldBinding<K> {
        const field = this.requireController().getField(name);
        if (options?.validate) field.setValidator(options.validate);
        return field;
    }

    private config(): ElementsConfig {
        return {
            clientSecret: this.clientSecret,
            initialCheckoutSession: this._initialCheckoutSession,
            appearance: this._appearance,
            onComplete: () => this._onComplete?.(),
        };
    }

    private attachController(): void {
        if (!this.core) {
            if (!this.clientSecret) return;
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
        if (this.ownsController) this.core.activate();
        this.handleStateChange();
        this.dispatchEvent(new CustomEvent("biasready", { bubbles: true }));
    }

    private detachController(): void {
        unregisterProvider(this);
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        if (this.ownsController) this.core?.deactivate();
        if (this.ownsController) this.core = undefined;
        this.lastStatus = undefined;
        this.lastError = undefined;
    }

    private updateOwnedConfig(): void {
        if (this.ownsController && this.core) this.core.updateConfig(this.config());
    }

    private handleStateChange(): void {
        if (!this.core) return;
        const state = this.core.getPublicState();
        const session = state.sessionState;
        const visible =
            (session.status !== "idle" && session.status !== "loading") || "session" in session;
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

    private applyAppearance(): void {
        const next = themeVariableStyle(this._appearance?.variables);
        for (const name of this.appliedVariables) {
            if (!(name in next)) this.style.removeProperty(name);
        }
        for (const [name, value] of Object.entries(next)) this.style.setProperty(name, value);
        this.appliedVariables = new Set(Object.keys(next));
    }

    private requireController(): ElementsController {
        if (!this.core) throw new Error("Bias Elements: <bias-provider> is not configured.");
        return this.core;
    }

    private setStringAttribute(name: string, value: string | undefined): void {
        if (value === undefined || value === "") this.removeAttribute(name);
        else this.setAttribute(name, value);
    }
}
