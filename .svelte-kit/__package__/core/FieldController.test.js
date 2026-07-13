import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFieldController } from "./FieldController";
class FakePort {
    onmessage = null;
    postMessage = vi.fn();
    start = vi.fn();
    close = vi.fn();
    dispatch(data) {
        this.onmessage?.({ data });
    }
}
const channels = [];
class FakeChannel {
    port1 = new FakePort();
    port2 = new FakePort();
    constructor() {
        channels.push(this);
    }
}
function setup(type = "cardNumber") {
    const onStateChange = vi.fn();
    const onEncryptedData = vi.fn();
    const postMessage = vi.fn();
    const iframe = {
        contentWindow: { postMessage },
        parentElement: null,
    };
    const controller = createFieldController({
        type,
        clientSecret: "cs_secret",
        frameUrl: "https://field.example.com/path?client_secret=leaked",
        onStateChange,
        onEncryptedData,
    });
    controller.setIframe(iframe);
    return { controller, iframe, postMessage, onStateChange, onEncryptedData };
}
function authenticate(postMessage) {
    const channelId = postMessage.mock.calls.at(-1)[0].channelId;
    const port = channels.at(-1).port1;
    port.dispatch({ type: "bias:channel-ready", channelId });
    port.dispatch({ type: "ready" });
    return port;
}
beforeEach(() => {
    channels.length = 0;
    vi.stubGlobal("MessageChannel", FakeChannel);
});
describe("secure field channel", () => {
    it("uses the requested field type in the URL", () => {
        const { controller } = setup("cardExpiry");
        expect(new URL(controller.iframeSrc).searchParams.get("type")).toBe("cardExpiry");
    });
    it("keeps the secret out of the iframe URL and transfers it to the exact origin", () => {
        const { controller, postMessage } = setup();
        const url = new URL(controller.iframeSrc);
        expect(url.searchParams.get("type")).toBe("cardNumber");
        expect(url.searchParams.has("client_secret")).toBe(false);
        expect(controller.iframeSrc).not.toContain("cs_secret");
        controller.handleIframeLoad();
        expect(postMessage).toHaveBeenCalledWith({
            type: "bias:initialize-field",
            field: "cardNumber",
            channelId: expect.any(String),
        }, "https://field.example.com", [channels[0].port2]);
        expect(JSON.stringify(postMessage.mock.calls[0])).not.toContain("cs_secret");
    });
    it("queues outbound messages until the private port reports ready", () => {
        const { controller, postMessage } = setup();
        controller.send({ type: "validateFields" });
        controller.handleIframeLoad();
        expect(channels[0].port1.postMessage).not.toHaveBeenCalled();
        const channelId = postMessage.mock.calls[0][0].channelId;
        channels[0].port1.dispatch({ type: "bias:channel-ready", channelId });
        channels[0].port1.dispatch({ type: "bias:channel-ready", channelId });
        expect(channels[0].port1.postMessage).toHaveBeenCalledWith({
            type: "bias:authenticate-field",
            channelId,
            clientSecret: "cs_secret",
        });
        expect(channels[0].port1.postMessage.mock.calls.filter(([message]) => message.type === "bias:authenticate-field")).toHaveLength(1);
        channels[0].port1.dispatch({ type: "ready" });
        expect(channels[0].port1.postMessage).toHaveBeenCalledWith({ type: "validateFields" });
    });
    it("ignores a channel acknowledgment with the wrong nonce", () => {
        const { controller } = setup();
        controller.handleIframeLoad();
        channels[0].port1.dispatch({ type: "bias:channel-ready", channelId: "wrong" });
        expect(channels[0].port1.postMessage).not.toHaveBeenCalled();
    });
    it("resets loading, validity, and encrypted data on load", () => {
        const { controller, onStateChange, onEncryptedData } = setup();
        controller.handleIframeLoad();
        expect(onStateChange).toHaveBeenCalledWith({ loading: true, valid: false, error: null });
        expect(onEncryptedData).toHaveBeenCalledWith("cardNumber", null);
    });
    it("handles an error message after authentication", () => {
        const { controller, postMessage, onStateChange } = setup();
        controller.handleIframeLoad();
        authenticate(postMessage).dispatch({ type: "error", error: "Invalid" });
        expect(onStateChange).toHaveBeenCalledWith({ error: "Invalid" });
    });
    it("handles a null error", () => {
        const { controller, postMessage, onStateChange } = setup();
        controller.handleIframeLoad();
        authenticate(postMessage).dispatch({ type: "error", error: null });
        expect(onStateChange).toHaveBeenCalledWith({ error: "" });
    });
    it("handles focus and blur", () => {
        const { controller, postMessage, onStateChange } = setup();
        controller.handleIframeLoad();
        const port = authenticate(postMessage);
        port.dispatch({ type: "focus" });
        port.dispatch({ type: "blur" });
        expect(onStateChange).toHaveBeenCalledWith({ focused: true });
        expect(onStateChange).toHaveBeenCalledWith({ focused: false });
    });
    it("handles empty state", () => {
        const { controller, postMessage, onStateChange } = setup();
        controller.handleIframeLoad();
        authenticate(postMessage).dispatch({ type: "empty", empty: false });
        expect(onStateChange).toHaveBeenCalledWith({ empty: false });
    });
    it("handles card brand", () => {
        const { controller, postMessage, onStateChange } = setup();
        controller.handleIframeLoad();
        authenticate(postMessage).dispatch({ type: "cardBrand", brand: "visa" });
        expect(onStateChange).toHaveBeenCalledWith({ cardBrand: "visa" });
    });
    it("accepts a null encrypted value for the registered field", () => {
        const { controller, postMessage, onEncryptedData } = setup();
        controller.handleIframeLoad();
        authenticate(postMessage).dispatch({
            type: "encryptedData",
            field: "cardNumber",
            encryptedValue: null,
        });
        expect(onEncryptedData).toHaveBeenLastCalledWith("cardNumber", null);
    });
    it("sends styles through the private port", () => {
        const { controller, postMessage } = setup();
        controller.handleIframeLoad();
        const port = authenticate(postMessage);
        controller.setStyle("color: blue");
        expect(port.postMessage).toHaveBeenCalledWith({ type: "style", style: "color: blue" });
    });
    it("closes a channel when the iframe element changes", () => {
        const { controller } = setup();
        controller.handleIframeLoad();
        const port = channels[0].port1;
        controller.setIframe(undefined);
        expect(port.close).toHaveBeenCalled();
    });
    it("does not initialize without an iframe", () => {
        const { controller, postMessage } = setup();
        controller.setIframe(undefined);
        controller.handleIframeLoad();
        expect(postMessage).not.toHaveBeenCalled();
    });
    it("ignores frame messages before the nonce handshake", () => {
        const { controller, onStateChange } = setup();
        controller.handleIframeLoad();
        onStateChange.mockClear();
        channels[0].port1.dispatch({ type: "ready" });
        expect(onStateChange).not.toHaveBeenCalled();
    });
    it("creates a fresh nonce and port for every load", () => {
        const { controller, postMessage } = setup();
        controller.handleIframeLoad();
        const firstNonce = postMessage.mock.calls[0][0].channelId;
        controller.handleIframeLoad();
        const secondNonce = postMessage.mock.calls[1][0].channelId;
        expect(secondNonce).not.toBe(firstNonce);
        expect(channels).toHaveLength(2);
    });
    it("validates payloads and rejects encrypted data for another field", () => {
        const { controller, postMessage, onStateChange, onEncryptedData } = setup();
        controller.handleIframeLoad();
        const port = authenticate(postMessage);
        onStateChange.mockClear();
        onEncryptedData.mockClear();
        port.dispatch({ type: "empty", empty: "false" });
        port.dispatch({ type: "error", error: { raw: "secret" } });
        port.dispatch({ type: "encryptedData", field: "cardExpiry", encryptedValue: "enc" });
        expect(onStateChange).not.toHaveBeenCalled();
        expect(onEncryptedData).not.toHaveBeenCalled();
        port.dispatch({ type: "encryptedData", field: "cardNumber", encryptedValue: "enc" });
        expect(onEncryptedData).toHaveBeenCalledWith("cardNumber", "enc");
    });
    it("treats every iframe load as a new generation", () => {
        const { controller, postMessage, onEncryptedData } = setup();
        controller.handleIframeLoad();
        const old = authenticate(postMessage);
        old.dispatch({ type: "encryptedData", field: "cardNumber", encryptedValue: "old" });
        controller.handleIframeLoad();
        expect(old.close).toHaveBeenCalled();
        expect(onEncryptedData).toHaveBeenLastCalledWith("cardNumber", null);
        old.dispatch({ type: "encryptedData", field: "cardNumber", encryptedValue: "stale" });
        expect(onEncryptedData).not.toHaveBeenCalledWith("cardNumber", "stale");
    });
    it("ignores delivery after destroy and closes the private port", () => {
        const { controller, postMessage, onStateChange } = setup();
        controller.handleIframeLoad();
        const port = authenticate(postMessage);
        onStateChange.mockClear();
        controller.destroy();
        port.dispatch({ type: "ready" });
        expect(port.close).toHaveBeenCalled();
        expect(onStateChange).not.toHaveBeenCalled();
    });
});
