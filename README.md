# Bias Elements

`@biaspay/elements` provides framework-neutral custom elements for embedded Bias checkouts. Sensitive card and bank account values stay inside Bias-hosted iframes; contact and address forms render in the host page.

## Installation

```sh
npm install @biaspay/elements
```

Svelte is bundled as the internal renderer. Consumers do not install Svelte or use a Svelte-specific API.

## Usage

Importing the package in a browser registers every `bias-*` element:

```html
<script type="module">
    import "@biaspay/elements";

    const provider = document.querySelector("bias-provider");
    provider.addEventListener("biascomplete", () => location.assign("/order-confirmed"));
    provider.addEventListener("biaserror", ({ detail }) => console.error(detail));
</script>

<bias-provider client-secret="cs_...">
    <bias-express-checkout-element show-separator></bias-express-checkout-element>
    <bias-contact-element></bias-contact-element>
    <bias-discount-code-element></bias-discount-code-element>
    <bias-payment-element payment-method-layout="tabs"></bias-payment-element>
    <bias-submit-button label="Pay now"></bias-submit-button>
</bias-provider>
```

`bias-express-checkout-element` renders Apple Pay when the session and browser support it on Bias Checkout. Apple Pay is not currently available for direct Elements embeds or custom checkout domains. Mount the element before contact and shipping fields for express checkout. It is complementary to the ordinary payment form: use exactly one of `bias-payment-element`, `bias-card-element`, or `bias-us-bank-account-element` for card and bank payments. Contact, discount-code, and billing or shipping address elements are optional. The discount-code element renders only when the session permits customer-entered codes or already has an entered code.

Use DOM properties for structured values and callbacks:

```js
const provider = document.querySelector("bias-provider");
provider.appearance = { variables: { colorPrimary: "#4f46e5" } };
provider.checkoutSessionExpand = { discounts: true };
provider.defaultValues = { email: "shopper@example.com" };
provider.onComplete = () => location.assign("/order-confirmed");
```

The provider exposes public state, `submit()`, `refreshSession()`, `setPaymentMethod()`, and `getField()`. It emits bubbling `biasready`, `biaschange`, `biascomplete`, and `biaserror` events.

## Your own submit button

`bias-submit-button` shows a session's renewal terms (`subscription_terms`) under itself, and paying through the session records the customer's agreement to them. With your own button, show `subscription_terms` next to it. The bank account form shows the debit authorization (`mandate_text`, or `company_mandate_text` for a business account) whenever the payment saves the account; keep it visible.

Elements render into light DOM, and each custom-element host uses `display: contents`. Multiple provider trees on the same page keep independent state.

## Documentation

See the [web components reference](https://biaspay.com/docs/sdks/elements) and [Elements quickstart](https://biaspay.com/docs/guides/checkout-elements/quickstart).

## Development

```sh
bun run check
bun run test
bun run build
```
