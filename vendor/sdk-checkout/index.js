// clients/typescript-checkout/src/retry.ts
function shouldRetry(response) {
  if (response.headers.get("idempotency-replay") === "true")
    return false;
  return response.status === 429 || response.status >= 500;
}
function timeoutTime(i) {
  const maxTimeout = 1000 * 15;
  return Math.min(2 ** i * 10, maxTimeout);
}
async function retry(fn, retries) {
  const retryCount = Math.max(0, Math.floor(retries));
  for (let i = 0;i <= retryCount; i++) {
    try {
      const response = await fn();
      if (response.ok || !shouldRetry(response) || i === retryCount) {
        return response;
      }
    } catch (error) {
      if (i === retryCount || typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, timeoutTime(i)));
  }
  throw new Error("Retry loop exited unexpectedly");
}

// clients/typescript-checkout/src/stream.ts
var IDLE_TIMEOUT_MS = 30000;
var MAX_RECONNECT_DELAY_MS = 30000;
var CATCH_UP_OVERLAP_MS = 5000;
var CATCH_UP_PAGE_SIZE = 100;
var SEEN_LIMIT = 1000;
async function* readStream({ response, controller }) {
  if (!response.body)
    throw new Error("No body on fetch response");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffered = "";
  try {
    for (;; ) {
      const { value, done } = await readWithin(reader, IDLE_TIMEOUT_MS);
      buffered += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffered.split(/\r?\n/);
      buffered = done ? "" : lines.pop();
      for (const line of lines) {
        if (line.trim())
          yield JSON.parse(line);
      }
      if (done)
        return;
    }
  } finally {
    controller.abort();
    reader.cancel().catch(() => {});
  }
}
async function* reconnectingStream(options) {
  const seen = new Set;
  const connectedAt = serverTime(options.first.response);
  let lastCreatedAt;
  let delivered = 0;
  let failures = 0;
  let connection = options.first;
  function accept(item) {
    if (seen.has(item.id))
      return false;
    seen.add(item.id);
    if (seen.size > SEEN_LIMIT)
      seen.delete(seen.values().next().value);
    lastCreatedAt = Math.max(lastCreatedAt ?? item.created_at, item.created_at);
    delivered += 1;
    return true;
  }
  for (;; ) {
    const openedAt = Date.now();
    let healthy = false;
    try {
      if (!connection) {
        connection = await options.connect();
        await check(connection.response);
        const floor = lastCreatedAt === undefined ? connectedAt : lastCreatedAt - CATCH_UP_OVERLAP_MS;
        for (const item of await missed(options, floor)) {
          if (!accept(item))
            continue;
          healthy = true;
          yield item;
          if (delivered === options.limit)
            return;
        }
      }
      for await (const item of readStream(connection)) {
        if (!accept(item))
          continue;
        healthy = true;
        yield item;
        if (delivered === options.limit)
          return;
      }
    } catch (error) {
      if (options.signal?.aborted || error instanceof BiasError)
        throw error;
    } finally {
      connection?.controller.abort();
      connection = undefined;
    }
    if (healthy || Date.now() - openedAt >= IDLE_TIMEOUT_MS)
      failures = 0;
    await wait(backoff(failures), options.signal);
    failures += 1;
  }
}
async function missed(options, floor) {
  const items = [];
  let startingAfter;
  for (;; ) {
    const { response } = await options.list({
      limit: CATCH_UP_PAGE_SIZE,
      starting_after: startingAfter
    });
    await check(response);
    const page = await response.json();
    for (const item of page.items) {
      if (item.created_at < floor)
        return items.reverse();
      items.push(item);
    }
    if (!page.has_more || !page.items.length)
      return items.reverse();
    startingAfter = page.items.at(-1).id;
  }
}
async function check(response) {
  if (response.ok)
    return;
  if (response.status === 408 || response.status === 429 || response.status >= 500) {
    await response.body?.cancel();
    throw new Error(`Event stream request failed with status ${response.status}`);
  }
  const body = await response.json().catch(() => {
    return;
  });
  throw new BiasError(body?.error?.message ?? `Event stream request failed with status ${response.status}`, body);
}
async function readWithin(reader, ms) {
  let timer;
  const stalled = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Event stream stalled")), ms);
  });
  try {
    return await Promise.race([reader.read(), stalled]);
  } finally {
    clearTimeout(timer);
  }
}
function serverTime(response) {
  const date = Date.parse(response.headers.get("date") ?? "");
  return Number.isNaN(date) ? Date.now() : date;
}
function backoff(failures) {
  const delay = Math.min(1000 * 2 ** failures, MAX_RECONNECT_DELAY_MS);
  return delay * (0.5 + Math.random() / 2);
}
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted)
      return reject(signal.reason);
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", done, { once: true });
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      if (signal?.aborted)
        reject(signal.reason);
      else
        resolve();
    }
  });
}

// clients/typescript-checkout/src/request.ts
function makePath(path, params) {
  return path.replace(/\{([^}]+)\}/g, (_, key) => {
    if (params[key] === undefined) {
      throw new Error(`Missing required path parameter: ${key}`);
    }
    return params[key];
  });
}
function pick(obj, keys) {
  const result = {};
  for (const key of keys) {
    result[key] = obj[key];
  }
  return result;
}
function platformString() {
  if (typeof navigator !== "undefined") {
    return "Browser";
  }
  if (typeof Bun !== "undefined") {
    return `Bun/${Bun.version}`;
  }
  if (typeof Deno !== "undefined") {
    return `Deno/${Deno.version.deno}`;
  }
  if (typeof process !== "undefined") {
    return `Node/${process.version}`;
  }
  return "Unknown";
}
function buildFormData(data) {
  const formData = new FormData;
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined)
      continue;
    formData.append(key, value);
  }
  return formData;
}
async function makeRequest(input, requestConfig, { config, ...resource }) {
  const mergedConfig = { ...config, ...requestConfig };
  const params = [...resource.params.query, ...resource.params.path, ...resource.params.body];
  for (const key of Object.keys(input)) {
    if (!params.includes(key)) {
      throw new BiasError(`Unexpected parameter: ${key}`);
    }
  }
  const connection = await send(input, mergedConfig, resource);
  const { response } = connection;
  if (input.stream === true && response.ok) {
    if (mergedConfig.reconnect === false)
      return readStream(connection);
    return reconnectingStream({
      first: connection,
      connect: () => send(input, mergedConfig, resource),
      list: (page) => send({ ...input, stream: undefined, ending_before: undefined, ...page }, mergedConfig, resource),
      limit: input.limit,
      signal: mergedConfig.signal
    });
  }
  const contentType = response.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json" && response.status >= 200 && response.status < 300) {
    const blob = await response.blob();
    const fileName = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1];
    return new File([blob], fileName || "file", { type: blob.type });
  }
  return await response.json();
}
async function send(input, mergedConfig, resource) {
  const queryString = new URLSearchParams(Object.fromEntries(Object.entries(pick(input, resource.params.query)).filter(([, value]) => value !== undefined).map(([key, value]) => [
    key,
    typeof value === "object" ? JSON.stringify(value) : value
  ]))).toString();
  const url = [
    mergedConfig.baseURL,
    makePath(resource.path, pick(input, resource.params.path)),
    queryString ? `?${queryString}` : ""
  ].join("");
  const bodyObject = pick(input, resource.params.body);
  const body = resource.params.body.length ? resource.contentType === "multipart/form-data" ? buildFormData(bodyObject) : JSON.stringify(bodyObject) : undefined;
  const idempotencyKey = mergedConfig.idempotencyKey ?? crypto.randomUUID();
  if (mergedConfig.signal?.aborted) {
    throw mergedConfig.signal.reason;
  }
  let controller;
  const response = await retry(async () => {
    controller = new AbortController;
    const onAbort = () => controller.abort(mergedConfig.signal.reason);
    mergedConfig.signal?.addEventListener("abort", onAbort);
    const promise = mergedConfig.fetch(url, {
      method: resource.method,
      body,
      headers: {
        "user-agent": `Bias JavaScript SDK/v1.0 (${platformString()})`,
        "api-version": "2025-07-01",
        ...resource.method === "POST" || resource.method === "PATCH" ? { "idempotency-key": idempotencyKey } : undefined,
        ...mergedConfig.apiKey !== null ? { Authorization: `Bearer ${mergedConfig.apiKey}` } : undefined,
        ...resource.contentType === "application/json" ? { "Content-Type": "application/json" } : undefined,
        ...mergedConfig.headers
      },
      signal: controller.signal
    });
    const timeout = setTimeout(() => controller.abort(), mergedConfig.timeout);
    return await promise.finally(() => {
      clearTimeout(timeout);
      mergedConfig.signal?.removeEventListener("abort", onAbort);
    });
  }, mergedConfig.networkRetries ?? 1);
  return { response, controller };
}

// clients/typescript-checkout/src/resource.ts
function resource(resource) {
  return (pathParams, otherParams, config) => {
    const mergedParams = { ...pathParams, ...otherParams };
    return makeRequest(mergedParams ?? {}, config ?? {}, resource);
  };
}

// clients/typescript-checkout/src/generated.ts
var resources = (config) => ({
  checkout: {
    address: {
      autocomplete: (params, requestConfig) => resource({
        path: "/v1/checkout/address/autocomplete",
        method: "GET",
        params: {
          path: [],
          query: ["input", "country"],
          body: []
        },
        config
      })({}, params, requestConfig),
      validate: (params, requestConfig) => resource({
        path: "/v1/checkout/address/validate",
        method: "POST",
        contentType: "application/json",
        params: {
          path: [],
          query: [],
          body: ["line1", "city", "state", "postal_code", "country"]
        },
        config
      })({}, params, requestConfig)
    },
    wallets: {
      applePay: {
        merchantSession: (params, requestConfig) => resource({
          path: "/v1/checkout/wallets/apple_pay/merchant_session",
          method: "POST",
          contentType: "application/json",
          params: {
            path: [],
            query: [],
            body: ["validation_url"]
          },
          config
        })({}, params, requestConfig),
        update: (params, requestConfig) => resource({
          path: "/v1/checkout/wallets/apple_pay/update",
          method: "POST",
          contentType: "application/json",
          params: {
            path: [],
            query: [],
            body: [
              "checkout_session_updated_at",
              "shipping_contact",
              "shipping_rate",
              "final",
              "billing_contact"
            ]
          },
          config
        })({}, params, requestConfig)
      },
      configuration: (params, requestConfig) => resource({
        path: "/v1/checkout/wallets/configuration",
        method: "GET",
        params: {
          path: [],
          query: [],
          body: []
        },
        config
      })({}, params, requestConfig)
    }
  },
  checkoutSessions: {
    get: (id, params, requestConfig) => resource({
      path: "/v1/checkout_sessions/{id}",
      method: "GET",
      params: {
        path: ["id"],
        query: ["expand"],
        body: []
      },
      config
    })({
      id
    }, params, requestConfig),
    update: (id, params, requestConfig) => resource({
      path: "/v1/checkout_sessions/{id}",
      method: "PATCH",
      contentType: "application/json",
      params: {
        path: ["id"],
        query: ["expand"],
        body: [
          "allow_discount_codes",
          "line_items",
          "discounts",
          "customer",
          "customer_details",
          "shipping_details",
          "shipping_address_collection",
          "billing_details_collection",
          "phone_number_collection",
          "billing_details",
          "shipping_options",
          "shipping_rate",
          "dual_pricing",
          "metadata"
        ]
      },
      config
    })({
      id
    }, params, requestConfig),
    discountCode: {
      apply: (id, params, requestConfig) => resource({
        path: "/v1/checkout_sessions/{id}/discount_code",
        method: "POST",
        contentType: "application/json",
        params: {
          path: ["id"],
          query: ["expand"],
          body: ["code"]
        },
        config
      })({
        id
      }, params, requestConfig),
      remove: (id, discount, params, requestConfig) => resource({
        path: "/v1/checkout_sessions/{id}/discount_code/{discount}",
        method: "DELETE",
        params: {
          path: ["id", "discount"],
          query: ["expand"],
          body: []
        },
        config
      })({
        id,
        discount
      }, params, requestConfig)
    }
  },
  events: {
    list: (params, requestConfig) => resource({
      path: "/v1/events",
      method: "GET",
      params: {
        path: [],
        query: [
          "expand",
          "ending_before",
          "starting_after",
          "limit",
          "stream",
          "filters"
        ],
        body: []
      },
      config
    })({}, params, requestConfig)
  },
  payments: {
    create: (params, requestConfig) => resource({
      path: "/v1/payments",
      method: "POST",
      contentType: "application/json",
      params: {
        path: [],
        query: ["expand"],
        body: [
          "amount",
          "checkout_session_updated_at",
          "capture_method",
          "customer",
          "description",
          "invoice",
          "metadata",
          "mandate_data",
          "off_session",
          "recurring",
          "remember",
          "payment_method",
          "statement_descriptor"
        ]
      },
      config
    })({}, params, requestConfig)
  }
});

// clients/typescript-checkout/src/auto_pagination.ts
async function* iterateListPages(resource, params, config) {
  let currentParams = { ...params };
  while (true) {
    const response = await resource(currentParams, config);
    if (response.object === "error") {
      yield response;
      return response;
    }
    yield response;
    if (!response.has_more) {
      break;
    }
    currentParams = {
      ...currentParams,
      starting_after: response.items[response.items.length - 1].id
    };
  }
  return {
    object: "list",
    has_more: false,
    items: []
  };
}
async function fetchListPages(resource, params, config) {
  const items = [];
  let hasMore = true;
  for await (const response of iterateListPages(resource, params, config)) {
    if (response.object === "error")
      return response;
    hasMore = response.has_more;
    items.push(...response.items);
    if (config.maxItems && items.length >= config.maxItems) {
      items.splice(config.maxItems);
      break;
    }
  }
  return {
    object: "list",
    items,
    has_more: hasMore
  };
}

// clients/typescript-checkout/src/index.ts
class BiasError extends Error {
  response;
  constructor(message, response) {
    super(message);
    this.name = "BiasError";
    this.response = response;
  }
}
function createBias(options) {
  const fetch_ = options.fetch ?? globalThis.fetch.bind(globalThis);
  if (!fetch_)
    throw new BiasError("No fetch implementation available");
  if (options.apiKey == null)
    throw new BiasError("No API key provided");
  const baseURL = options.baseURL ?? "https://api.biaspay.com";
  const networkRetries = options.networkRetries ?? 1;
  const timeout = options.timeout ?? 30000;
  return resources({
    apiKey: options.apiKey,
    fetch: fetch_,
    baseURL,
    networkRetries,
    timeout,
    headers: options.headers
  });
}
var Bias = createBias;
function assertExpanded(value) {
  if (typeof value === "string")
    throw new BiasError(`The field/value provided was not expanded in the request. Expected object, received ${value}.`);
  return value;
}
function getId(field) {
  return typeof field === "string" ? field : field.id;
}
export {
  Bias,
  BiasError,
  assertExpanded,
  fetchListPages,
  getId,
  iterateListPages
};
