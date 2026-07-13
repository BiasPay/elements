function createFieldUrl(frameUrl, type) {
    const baseHref = typeof window === "undefined" ? "http://localhost" : window.location.href;
    const url = new URL(frameUrl, baseHref);
    url.searchParams.set("type", type);
    // The client secret is transferred only after a private channel exists.
    url.searchParams.delete("client_secret");
    return url.toString();
}
function isFrameMessage(value, field) {
    if (!value || typeof value !== "object")
        return false;
    const message = value;
    switch (message.type) {
        case "ready":
        case "focus":
        case "blur":
            return true;
        case "error":
            return message.error === null || typeof message.error === "string";
        case "empty":
            return typeof message.empty === "boolean";
        case "cardBrand":
            return message.brand === null || typeof message.brand === "string";
        case "encryptedData":
            return (message.field === field &&
                (message.encryptedValue === null || typeof message.encryptedValue === "string"));
        default:
            return false;
    }
}
export function createFieldController(options) {
    let iframe;
    let resizeObserver;
    let port;
    let frameReady = false;
    let destroyed = false;
    let generation = 0;
    let messageQueue = [];
    const iframeSrc = createFieldUrl(options.frameUrl, options.type);
    const origin = new URL(iframeSrc).origin;
    function closeChannel() {
        generation++;
        frameReady = false;
        port?.close();
        port = undefined;
    }
    function send(message) {
        if (destroyed)
            return;
        if (!frameReady || !port) {
            messageQueue.push(message);
            return;
        }
        port.postMessage(message);
    }
    function acceptMessage(message) {
        if (message.type === "ready") {
            frameReady = true;
            for (const queued of messageQueue)
                port?.postMessage(queued);
            messageQueue = [];
            options.onStateChange({ loading: false });
        }
        else if (message.type === "error") {
            options.onStateChange({ error: message.error ?? "" });
        }
        else if (message.type === "focus") {
            options.onStateChange({ focused: true });
        }
        else if (message.type === "blur") {
            options.onStateChange({ focused: false });
        }
        else if (message.type === "empty") {
            options.onStateChange({ empty: message.empty });
        }
        else if (message.type === "cardBrand") {
            options.onStateChange({ cardBrand: message.brand });
        }
        else if (message.type === "encryptedData") {
            options.onEncryptedData?.(message.field, message.encryptedValue);
        }
    }
    function initializeChannel() {
        closeChannel();
        options.onEncryptedData?.(options.type, null);
        options.onStateChange({ loading: true, valid: false, error: null });
        if (destroyed || !iframe?.contentWindow || typeof MessageChannel === "undefined")
            return;
        const ownedGeneration = generation;
        const ownedChannelId = typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;
        const channel = new MessageChannel();
        let channelBound = false;
        port = channel.port1;
        port.onmessage = (event) => {
            if (destroyed || ownedGeneration !== generation)
                return;
            if (!frameReady &&
                !channelBound &&
                event.data &&
                typeof event.data === "object" &&
                event.data.type === "bias:channel-ready" &&
                event.data.channelId === ownedChannelId) {
                channelBound = true;
                port?.postMessage({
                    type: "bias:authenticate-field",
                    channelId: ownedChannelId,
                    clientSecret: options.clientSecret,
                });
                return;
            }
            if (!channelBound)
                return;
            if (!isFrameMessage(event.data, options.type))
                return;
            if (!frameReady && event.data.type !== "ready")
                return;
            acceptMessage(event.data);
        };
        port.start();
        iframe.contentWindow.postMessage({
            type: "bias:initialize-field",
            field: options.type,
            channelId: ownedChannelId,
        }, origin, [channel.port2]);
    }
    function observeWrapper() {
        const wrapper = iframe?.parentElement;
        if (!wrapper || typeof ResizeObserver === "undefined")
            return;
        resizeObserver?.disconnect();
        resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry)
                return;
            const size = Array.isArray(entry.borderBoxSize)
                ? entry.borderBoxSize[0]
                : entry.borderBoxSize;
            send({
                type: "resize",
                width: size?.inlineSize ?? entry.contentRect.width,
                height: size?.blockSize ?? entry.contentRect.height,
            });
        });
        resizeObserver.observe(wrapper);
    }
    return {
        iframeSrc,
        setIframe(element) {
            if (iframe === element)
                return;
            closeChannel();
            iframe = element;
        },
        send,
        setStyle(css) {
            send({ type: "style", style: css });
        },
        handleIframeLoad() {
            if (destroyed)
                return;
            observeWrapper();
            initializeChannel();
        },
        destroy() {
            if (destroyed)
                return;
            destroyed = true;
            closeChannel();
            messageQueue = [];
            resizeObserver?.disconnect();
            iframe = undefined;
        },
    };
}
