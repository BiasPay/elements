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
    <bias-contact-element></bias-contact-element>
    <bias-payment-element payment-method-layout="tabs"></bias-payment-element>
    <bias-submit-button label="Pay now"></bias-submit-button>
</bias-provider>
```

Use exactly one payment surface—`bias-payment-element`, `bias-card-element`, or `bias-us-bank-account-element`—under each provider. Contact and billing or shipping address elements are optional.

Use DOM properties for structured values and callbacks:

```js
const provider = document.querySelector("bias-provider");
provider.appearance = { variables: { colorPrimary: "#4f46e5" } };
provider.initialCheckoutSession = session;
provider.onComplete = () => location.assign("/order-confirmed");
```

The provider exposes public state, `submit()`, `refreshSession()`, `setPaymentMethod()`, and `getField()`. It emits bubbling `biasready`, `biaschange`, `biascomplete`, and `biaserror` events.

Elements render into light DOM, and each custom-element host uses `display: contents`. Multiple provider trees on the same page keep independent state.

## Documentation

See the [web components reference](https://biaspay.com/docs/sdks/elements) and [Elements quickstart](https://biaspay.com/docs/guides/checkout-elements/quickstart).

## Development

```sh
bun run check
bun run test
bun run build
```
