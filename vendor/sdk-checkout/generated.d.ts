export type Error = ServerError | PaymentError | InvalidRequestError | IdempotencyError | RateLimitError;
export type ApiKeyExpand = Record<PropertyKey, never>;
export type ApiKey = {
	/**
	* The object's type.
	*/
	object: "api_key";
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* Whether the key can authenticate requests.
	*/
	active: boolean;
	/**
	* The key's description.
	*/
	description: string;
};
export type InvalidRequestError = {
	/**
	* The object's type.
	*/
	object: "error";
	/**
	* Details about the error.
	*/
	error: {
		type: "invalid_request_error";
		/**
		* `true` for a live request, `false` for a sandbox request, or `null` if the request wasn't authenticated as a merchant.
		*/
		live: boolean | null;
		/**
		* A code for errors an integration can handle.
		*/
		code: ("already_expired" | "decryption_failed" | "amount_exceeds_available" | "amount_mismatch" | "customer_mismatch" | "checkout_totals_changed" | "unsupported_currency" | "invoice_mismatch" | "invalid_code" | "expired" | "exhausted" | "feature_unavailable" | "minimum_not_met" | "already_used" | "incorrect_http_method" | "invalid_api_key" | "invalid_authorization_scheme" | "invalid_parameters" | "invoice_not_sendable" | "invoice_not_payable" | "malformed_request" | "resource_deactivated" | "resource_immutable" | "resource_in_use" | "resource_missing" | "resource_unassignable" | "session_closed" | "suspicious_request" | "uncancelable_payment" | "uncapturable_payment" | "unrefundable_payment" | "payment_method_unavailable" | "mandate_required" | "off_session_unavailable" | "no_upcoming_invoice" | "url_invalid" | "wrong_file_purpose" | "#expired_otp" | "#invalid_email" | "#invalid_merchant" | "#invalid_code" | "#invalid_session" | "#expired_password" | "#account_locked" | "#insufficient_permissions" | "#partner_setup_incomplete" | "#application_submission_unavailable" | "#application_submission_failed" | "#shopify_connection_unavailable" | "#shopify_cart_unmappable" | "#shopify_cart_unavailable" | "#shopify_checkout_restart_required" | "#checkout_payment_in_progress" | "#shopify_checkout_disabled" | "#shopify_storefront_origin_missing" | "#shopify_scope_reapproval_required" | "#shopify_cart_currency_unsupported" | "#shopify_cart_unsupported" | "#shopify_checkout_native_bypass" | "#shopify_store_connected_elsewhere" | "#shopify_store_installing_elsewhere" | "#shopify_store_disconnecting" | "#shopify_disconnect_required" | "#billing_portal_disabled" | "#billing_portal_signed_out") | null;
		/**
		* A message about the error, written for developers.
		*/
		message: string;
		/**
		* A message about the error that's safe to show to the customer.
		*/
		customer_message: string | null;
		/**
		* The request parameter the error relates to.
		*/
		param: string | null;
	};
};
export type RateLimitError = {
	/**
	* The object's type.
	*/
	object: "error";
	/**
	* Details about the error.
	*/
	error: {
		type: "rate_limit_error";
		/**
		* `true` for a live request, `false` for a sandbox request, or `null` if the request wasn't authenticated as a merchant.
		*/
		live: boolean | null;
		code: null;
		/**
		* A message about the error, written for developers.
		*/
		message: string;
		/**
		* A message about the error that's safe to show to the customer.
		*/
		customer_message: string | null;
		param: null;
	};
};
export type ServerError = {
	/**
	* The object's type.
	*/
	object: "error";
	/**
	* Details about the error.
	*/
	error: {
		type: "server_error";
		/**
		* `true` for a live request, `false` for a sandbox request, or `null` if the request wasn't authenticated as a merchant.
		*/
		live: boolean | null;
		code: null;
		/**
		* A message about the error, written for developers.
		*/
		message: string;
		/**
		* A message about the error that's safe to show to the customer.
		*/
		customer_message: string | null;
		param: null;
	};
};
export type TimestampFilter = {
	/**
	* @min -8640000000000000
	* @max 8640000000000000
	*/
	eq?: number;
	/**
	* @min -8640000000000000
	* @max 8640000000000000
	*/
	gt?: number;
	/**
	* @min -8640000000000000
	* @max 8640000000000000
	*/
	gte?: number;
	/**
	* @min -8640000000000000
	* @max 8640000000000000
	*/
	lt?: number;
	/**
	* @min -8640000000000000
	* @max 8640000000000000
	*/
	lte?: number;
	exists?: boolean;
};
export type IdempotencyError = {
	/**
	* The object's type.
	*/
	object: "error";
	/**
	* Details about the error.
	*/
	error: {
		type: "idempotency_error";
		/**
		* `true` for a live request, `false` for a sandbox request, or `null` if the request wasn't authenticated as a merchant.
		*/
		live: boolean | null;
		code: IdempotencyErrorCode | null;
		/**
		* A message about the error, written for developers.
		*/
		message: string;
		/**
		* A message about the error that's safe to show to the customer.
		*/
		customer_message: string | null;
		param: null;
	};
};
export type IdempotencyErrorCode = "idempotency_key_in_use" | "idempotency_params_mismatch" | "idempotency_outcome_unknown";
export type MerchantPricingTerms = {
	/**
	* The object's type.
	*/
	object: "merchant_pricing_terms";
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	effective_from: number;
	/**
	* @min 0
	* @max 100
	*/
	volume_markup: number;
	/**
	* @min 0
	*/
	transaction_fee_amount: number;
	/**
	* @min 0
	*/
	monthly_fee_amount: number;
	/**
	* @min 0
	*/
	chargeback_fee_amount: number;
};
export type CountryCode = "AC" | "AD" | "AE" | "AF" | "AG" | "AI" | "AL" | "AM" | "AO" | "AQ" | "AR" | "AS" | "AT" | "AU" | "AW" | "AX" | "AZ" | "BA" | "BB" | "BD" | "BE" | "BF" | "BG" | "BH" | "BI" | "BJ" | "BL" | "BM" | "BN" | "BO" | "BQ" | "BR" | "BS" | "BT" | "BV" | "BW" | "BY" | "BZ" | "CA" | "CC" | "CD" | "CF" | "CG" | "CH" | "CI" | "CK" | "CL" | "CM" | "CN" | "CO" | "CR" | "CU" | "CV" | "CW" | "CX" | "CY" | "CZ" | "DE" | "DJ" | "DK" | "DM" | "DO" | "DZ" | "EC" | "EE" | "EG" | "EH" | "ER" | "ES" | "ET" | "FI" | "FJ" | "FK" | "FM" | "FO" | "FR" | "GA" | "GB" | "GD" | "GE" | "GF" | "GG" | "GH" | "GI" | "GL" | "GM" | "GN" | "GP" | "GQ" | "GR" | "GS" | "GT" | "GU" | "GW" | "GY" | "HK" | "HM" | "HN" | "HR" | "HT" | "HU" | "ID" | "IE" | "IL" | "IM" | "IN" | "IO" | "IQ" | "IR" | "IS" | "IT" | "JE" | "JM" | "JO" | "JP" | "KE" | "KG" | "KH" | "KI" | "KM" | "KN" | "KP" | "KR" | "KW" | "KY" | "KZ" | "LA" | "LB" | "LC" | "LI" | "LK" | "LR" | "LS" | "LT" | "LU" | "LV" | "LY" | "MA" | "MC" | "MD" | "ME" | "MF" | "MG" | "MH" | "MK" | "ML" | "MM" | "MN" | "MO" | "MP" | "MQ" | "MR" | "MS" | "MT" | "MU" | "MV" | "MW" | "MX" | "MY" | "MZ" | "NA" | "NC" | "NE" | "NF" | "NG" | "NI" | "NL" | "NO" | "NP" | "NR" | "NU" | "NZ" | "OM" | "PA" | "PE" | "PF" | "PG" | "PH" | "PK" | "PL" | "PM" | "PN" | "PR" | "PS" | "PT" | "PW" | "PY" | "QA" | "RE" | "RO" | "RS" | "RU" | "RW" | "SA" | "SB" | "SC" | "SD" | "SE" | "SG" | "SH" | "SI" | "SJ" | "SK" | "SL" | "SM" | "SN" | "SO" | "SR" | "SS" | "ST" | "SV" | "SX" | "SY" | "SZ" | "TA" | "TC" | "TD" | "TF" | "TG" | "TH" | "TJ" | "TK" | "TL" | "TM" | "TN" | "TO" | "TR" | "TT" | "TV" | "TW" | "TZ" | "UA" | "UG" | "UM" | "US" | "UY" | "UZ" | "VA" | "VC" | "VE" | "VG" | "VI" | "VN" | "VU" | "WF" | "WS" | "XK" | "YE" | "YT" | "ZA" | "ZM" | "ZW";
export type Address = {
	/**
	* The first line of the address.
	*/
	line1: string | null;
	/**
	* The second line of the address, such as a unit or floor.
	*/
	line2: string | null;
	/**
	* The city.
	*/
	city: string | null;
	/**
	* The state or province.
	*/
	state: string | null;
	/**
	* The postal or ZIP code.
	*/
	postal_code: string | null;
	/**
	* The country.
	*/
	country: CountryCode | null;
};
export type CheckoutWalletConfiguration = {
	apple_pay: ApplePayWalletConfiguration | null;
};
export type ApplePayWalletConfiguration = {
	enabled: boolean;
	country_code: "US";
	currency_code: "USD";
	supported_networks: ("visa" | "masterCard" | "amex" | "discover")[];
	merchant_capabilities: "supports3DS"[];
	display_name: string;
};
export type ShippingDetails = {
	/**
	* The recipient's name.
	*/
	name: string | null;
	/**
	* The recipient's phone number.
	*/
	phone: string | null;
	/**
	* The shipping address.
	*/
	address: Address;
};
export type Card = {
	/**
	* The object's type.
	*/
	object: "card";
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* The first 6 to 8 digits of the card number.
	*/
	bin: string;
	/**
	* The card brand, such as Visa or Mastercard.
	*/
	brand: string;
	/**
	* Results of the address and CVC checks.
	*/
	checks: {
		/**
		* The street address check.
		*/
		address_line_1: ("pass" | "fail" | "unavailable" | "unchecked") | null;
		/**
		* The postal code check.
		*/
		address_postal_code: ("pass" | "fail" | "unavailable" | "unchecked") | null;
		/**
		* The CVC check.
		*/
		cvc: (("pass" | "fail" | "unavailable" | "unchecked") | null) | null;
	};
	/**
	* The country that issued the card.
	*/
	country: string | null;
	/**
	* The expiration month.
	*/
	exp_month: number;
	/**
	* The expiration year.
	*/
	exp_year: number;
	/**
	* Identifies the card number. The same card has the same fingerprint.
	*/
	fingerprint: string | null;
	/**
	* The card's funding type.
	*/
	funding: "credit" | "debit" | "prepaid" | "unknown";
	/**
	* The bank that issued the card.
	*/
	issuer: string | null;
	/**
	* The last 4 digits of the card number.
	*/
	last4: string;
};
export type UsBankAccount = {
	/**
	* The object's type.
	*/
	object: "us_bank_account";
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* The type of bank account.
	*/
	account_type: "checking" | "savings";
	/**
	* Whether the account belongs to a person or a business.
	*/
	account_holder_type: "individual" | "company";
	/**
	* The name of the bank.
	*/
	bank_name: string | null;
	/**
	* Identifies the routing and account number. The same bank account has the same fingerprint.
	*/
	fingerprint: string | null;
	/**
	* The last 4 digits of the account number.
	*/
	last4: string;
	/**
	* The 9-digit routing number.
	*/
	routing_number: string;
};
export type AddressAutocompleteSuggestion = {
	label: string;
	secondary_label: string;
	full_address: string;
	components: {
		country?: {
			name?: string;
			code?: string;
		};
		region?: {
			name?: string;
			code?: string;
		};
		postal_code?: string;
		district?: string;
		place?: string;
		locality?: string;
		address?: string;
	};
};
export type AddressValidationResult = {
	verdict: "valid" | "suggestion" | "invalid" | "unverifiable";
	confidence?: "exact" | "high" | "medium" | "low";
	matches?: {
		postal_code?: "matched" | "unmatched";
		state?: "matched" | "unmatched";
	};
	suggested_address?: Address;
	reason?: "address_mismatch" | "postal_region_mismatch";
};
export type CheckoutSession = {
	/**
	* The object's type.
	*/
	object: "checkout_session";
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* When the object was last updated, in milliseconds since the Unix epoch.
	*/
	updated_at: number;
	/**
	* The total in cents, including shipping and tax. For an invoice's session, it's what the invoice has left to pay.
	* @min 0
	*/
	total: number;
	/**
	* The line items' amount after discounts, before shipping and tax, in cents.
	* @min 0
	*/
	subtotal: number;
	/**
	* The amount the session's successful payments collected, in cents.
	*/
	amount_collected: number;
	/**
	* The amount left to pay in cents, after payments that succeeded or are processing. `0` once the session isn't `open`. With dual pricing, card payments charge `dual_pricing.amount_remaining` instead.
	* @min 0
	*/
	amount_remaining: number;
	/**
	* The tax in `total`, in cents.
	* @min 0
	*/
	tax_total: number;
	/**
	* Whether the customer can enter discount codes.
	*/
	allow_discount_codes: boolean;
	/**
	* Dual pricing on a one-off invoice's session that accepts bank payments. Card payments pay `total` plus `rate`, and bank payments pay `total`.
	*/
	dual_pricing: {
		/**
		* The percentage card payments add, such as `3` for 3%.
		*/
		rate: number;
		/**
		* The amount left to pay at the card price, in cents.
		* @min 0
		*/
		amount_remaining: number;
	} | null;
	/**
	* The customer's browser, recorded when they open the session.
	*/
	client_details: {
		/**
		* A fingerprint of the customer's browser.
		*/
		fingerprint: string | null;
		/**
		* The customer's IP address.
		*/
		ip_address: string | null;
		/**
		* The customer's device type.
		*/
		device_type: SessionDeviceType | null;
	} | null;
	/**
	* The secret that loads the session in Checkout elements.
	*/
	client_secret: string;
	/**
	* Expandable. The session's customer. Without one, Bias creates a customer from `customer_details` when the session completes.
	*/
	customer: (string | Customer) | null;
	/**
	* The customer's contact details.
	*/
	customer_details: {
		/**
		* The customer's email address.
		*/
		email: string | null;
		/**
		* The customer's full name or business name.
		*/
		name: string | null;
		/**
		* The customer's phone number.
		*/
		phone: string | null;
	};
	/**
	* The selected shipping option.
	*/
	shipping_cost: {
		/**
		* Expandable. The selected shipping rate.
		*/
		shipping_rate: string | ShippingRate;
		/**
		* The shipping cost, in cents.
		* @min 0
		*/
		amount: number;
	} | null;
	/**
	* The name, phone and address the order ships to.
	*/
	shipping_details: ShippingDetails | null;
	/**
	* Where checkout collects a shipping address, or `null` when it doesn't collect one.
	*/
	shipping_address_collection: ShippingAddressCollection | null;
	/**
	* Which billing details checkout collects, or `null` when it doesn't collect any.
	*/
	billing_details_collection: BillingDetailsCollection | null;
	/**
	* Whether checkout collects the customer's phone number. Sessions that collect a shipping address ask for it there and save it as the shipping phone too.
	*/
	phone_number_collection: boolean;
	/**
	* The billing name and address.
	*/
	billing_details: {
		/**
		* The billing name.
		*/
		name: string | null;
		/**
		* The billing address.
		*/
		address: Address;
	} | null;
	/**
	* The shipping options the customer can choose from.
	*/
	shipping_options: {
		/**
		* The option's shipping cost, in cents.
		* @min 0
		*/
		shipping_amount: number;
		/**
		* The shipping rate.
		*/
		shipping_rate: string | ShippingRate;
		/**
		* Expected delivery dates in the store's time zone, or `null` when unknown.
		*/
		delivery_dates: {
			/**
			* The earliest expected delivery date.
			*/
			earliest: string | null;
			/**
			* The latest expected delivery date.
			*/
			latest: string | null;
		} | null;
		/**
		* How many packages the order ships in with this option.
		*/
		package_count: number;
	}[];
	/**
	* Whether shipping options are still being calculated.
	*/
	shipping_options_pending: boolean;
	/**
	* Changes the checkout made to the buyer's order that the buyer should see.
	*/
	notices: CheckoutSessionNotice[];
	/**
	* Expandable. The session's payments.
	*/
	payments: (Payment[] | null) | null;
	/**
	* Expandable. The invoice the session pays.
	*/
	invoice: (string | Invoice) | null;
	/**
	* In `subscription` mode, the subscription the session created. In `setup` mode, the subscription whose payment method it replaces.
	*/
	subscription: string | null;
	/**
	* The renewal terms the customer agrees to by paying, shown under the payment button.
	*/
	subscription_terms: string | null;
	/**
	* Settings for the subscription a `subscription` mode session creates.
	*/
	subscription_data: {
		/**
		* The days of free trial the subscription starts with, from when the session completes.
		*/
		trial_period_days: number | null;
		/**
		* Metadata for the subscription the session creates.
		*/
		metadata: Metadata;
	} | null;
	/**
	* The ACH debit authorization the customer accepts when the session saves a personal bank account for later payments, recorded on the account's [mandate](/api/mandates). `null` when the session doesn't save bank accounts.
	*/
	mandate_text: string | null;
	/**
	* The `mandate_text` for a company bank account (`account_holder_type: company`).
	*/
	company_mandate_text: string | null;
	/**
	* Expandable. What the customer is buying.
	*/
	line_items: LineItem[] | null;
	/**
	* Expandable. Discounts on the whole session.
	*/
	discounts: AppliedDiscount[] | null;
	metadata: Metadata;
	mode: SessionMode;
	/**
	* The payment method types the customer can pay with.
	*/
	payment_method_types: ("card" | "us_bank_account" | "apple_pay")[];
	status: SessionStatus;
	submit_label: SessionSubmitLabel;
	/**
	* Where Bias Checkout sends the customer after the session completes.
	*/
	success_url: string | null;
	/**
	* The session's Bias Checkout page.
	*/
	url: string;
};
export type SessionDeviceType = "mobile" | "desktop";
export type Customer = {
	/**
	* The object's type.
	*/
	object: "customer";
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* When the object was last updated, in milliseconds since the Unix epoch.
	*/
	updated_at: number;
	/**
	* Whether the customer has been deleted.
	*/
	deleted: boolean;
	/**
	* The customer's full name or business name.
	*/
	name: string | null;
	/**
	* The customer's email address.
	*/
	email: string | null;
	/**
	* The customer's phone number.
	*/
	phone: string | null;
	/**
	* The customer's saved shipping recipient and address.
	*/
	shipping_details: ShippingDetails | null;
	/**
	* The payment method charged for the customer's invoices and subscriptions that don't set their own `default_payment_method`.
	*/
	default_payment_method: string | null;
	/**
	* The customer's balance in cents: credit when positive, owed when negative. It's applied to the customer's invoices when they're finalized.
	*/
	balance: number;
	/**
	* The customer's record in a connected accounting system.
	*/
	external_sync: ExternalSync | null;
	metadata: Metadata;
};
export type ExternalSync = {
	/**
	* The connected accounting system.
	*/
	provider: "quickbooks";
	/**
	* The record's ID in that system.
	*/
	external_id: string;
};
export type Metadata = {
	[key: string]: any;
};
export type ShippingRate = {
	/**
	* The object's type.
	*/
	object: "shipping_rate";
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* When the object was last updated, in milliseconds since the Unix epoch.
	*/
	updated_at: number;
	/**
	* Whether the shipping rate has been deleted.
	*/
	deleted: boolean;
	/**
	* Whether the shipping rate can be set on a subscription.
	*/
	active: boolean;
	/**
	* The shipping rate's name, shown to customers.
	*/
	display_name: string;
	/**
	* The shipping cost, in cents.
	* @min 0
	*/
	amount: number;
	/**
	* How long delivery is estimated to take.
	*/
	delivery_estimate: {
		/**
		* The upper bound of the estimated range, inclusive.
		*/
		maximum: {
			/**
			* The unit of `value`.
			*/
			unit: DeliveryEstimateUnit;
			/**
			* The number of `unit`s.
			*/
			value: number;
		} | null;
		/**
		* The lower bound of the estimated range, inclusive.
		*/
		minimum: {
			/**
			* The unit of `value`.
			*/
			unit: DeliveryEstimateUnit;
			/**
			* The number of `unit`s.
			*/
			value: number;
		} | null;
	} | null;
	metadata: Metadata;
};
export type DeliveryEstimateUnit = "business_day" | "day" | "month" | "week";
export type ShippingAddressCollection = {
	/**
	* The countries a shipping address can be in.
	*/
	allowed_countries: CountryCode[];
};
export type BillingDetailsCollection = {
	/**
	* Whether checkout collects the billing name.
	*/
	name: boolean;
	/**
	* Whether checkout collects the full billing address. Card payments collect the billing country and postal code either way.
	*/
	address: boolean;
};
export type CheckoutSessionNotice = {
	code: SessionNoticeCode;
	/**
	* Buyer-facing text describing the change.
	*/
	message: string;
	/**
	* The line item the notice is about, or `null` when it no longer exists.
	*/
	line_item: string | null;
	/**
	* Whether the session cannot be paid until the buyer starts over.
	*/
	blocks_payment: boolean;
};
export type SessionNoticeCode = "line_item_quantity_reduced" | "line_item_removed" | "line_item_price_changed" | "line_items_unavailable" | "discount_code_not_applied" | "discount_code_no_longer_applies" | "subscription_not_started" | "subscription_refund_failed" | "payment_method_not_used_for_subscription";
export type Payment = {
	/**
	* The object's type.
	*/
	object: "payment";
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* Expandable. The merchant that owns the payment. Only included in an organization context.
	*/
	merchant?: string | Merchant;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* The amount of the payment, in cents.
	*/
	amount: number;
	/**
	* The amount that can still be captured.
	*/
	amount_capturable: number;
	/**
	* The amount collected.
	*/
	amount_received: number;
	/**
	* The amount refunded.
	*/
	amount_refunded: number;
	/**
	* The fees on the payment, in cents. Each is `null` until it's known.
	*/
	fees: {
		/**
		* The interchange fee set by the card network.
		*/
		interchange: number | null;
		/**
		* The fee for a chargeback on the payment.
		*/
		chargeback: number | null;
		/**
		* The platform fee.
		*/
		platform: number | null;
		/**
		* The total of the payment's fees.
		*/
		total: number | null;
	};
	/**
	* Organization-specific revenue details. Included after allocation completes, including when the selected organization earned zero. Not included outside of an organization context or when no completed allocation applies.
	*/
	organization_revenue_details?: {
		/**
		* Whether organization revenue was allocated or terminally skipped for this source.
		*/
		outcome: "allocated" | "skipped";
		/**
		* Why organization revenue was skipped, or null when it was allocated.
		*/
		skip_reason: "commercial_terms_not_effective" | null;
		/**
		* The total residual revenue earned by the selected organization, in cents.
		*/
		amount: number;
		/**
		* The merchant fee components evaluated by the revenue allocation.
		*/
		fees: {
			type: "volume_fee" | "transaction_fee" | "monthly_fee" | "chargeback_fee";
			/**
			* The fee charged to the merchant, in cents.
			*/
			merchant_fee_amount: number;
			/**
			* The residual revenue earned by the selected organization, in cents.
			*/
			residual_amount: number;
		}[];
	};
	/**
	* When to capture the payment.
	*/
	capture_method: "automatic" | "manual";
	/**
	* Expandable. The payment's customer.
	*/
	customer: (string | Customer) | null;
	/**
	* What the payment is for.
	*/
	description: string | null;
	metadata: Metadata;
	/**
	* Why a `failed` payment failed.
	*/
	payment_error: {
		/**
		* A message about the failure that's safe to show the customer.
		*/
		message: string | null;
		/**
		* The parameter that caused the error.
		*/
		param: string | null;
		/**
		* Why the payment was declined, as a [decline code](/api/decline-codes).
		*/
		code: PaymentDeclineCode | null;
		/**
		* The decline code from the card network.
		*/
		network_decline_code: string | null;
	} | null;
	/**
	* Expandable. The payment method used for the payment.
	*/
	payment_method: string | PaymentMethod;
	/**
	* The statement descriptor for the payment.
	*/
	statement_descriptor: string | null;
	status: PaymentStatus;
	/**
	* Expandable. The latest dispute received for this payment.
	*/
	dispute: (string | Dispute) | null;
	/**
	* Expandable. The checkout session this payment was created from.
	*/
	session: (string | CheckoutSession) | null;
	/**
	* Expandable. The invoice this payment was created from.
	*/
	invoice: (string | Invoice) | null;
	/**
	* The [mandate](/api/mandates) a bank account debit was made under.
	*/
	mandate: string | null;
	/**
	* Whether the payment was merchant-initiated, without the customer present.
	*/
	off_session: boolean | null;
	/**
	* Whether the merchant-initiated payment is one in a series charged on a fixed schedule, such as a subscription renewal.
	*/
	recurring: boolean | null;
	/**
	* Present when the customer's bank returned the debit. A debit returned after it succeeded keeps its status and gets a `lost` [dispute](/api/disputes).
	*/
	ach_return: {
		/**
		* The Nacha return code, such as `R01`.
		*/
		return_code: string | null;
		/**
		* When the debit was returned.
		*/
		returned_at: number;
	} | null;
};
export type Merchant = {
	/**
	* The object's type.
	*/
	object: "merchant";
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* Whether the merchant has been deleted.
	*/
	deleted: boolean;
	live: boolean;
	name: string;
	legal_name: string;
	mid: string | null;
	active: boolean;
	/**
	* The organization that owns this merchant.
	*/
	organization?: {
		id: string;
		name: string;
	} | null;
	active_card_gateway: string | null;
	/**
	* The payment method types available to this merchant. Controls which types can be enabled in merchant settings.
	*/
	available_payment_method_types: ("card" | "us_bank_account" | "apple_pay")[];
	/**
	* Flags that change which features this merchant has. `gateway_only` merchants process through their own gateway, so Bias tracks no disputes, deposits, reserves, processing statements, or residuals for them.
	*/
	flags: "gateway_only"[];
	/**
	* The merchant's public and payment settings.
	*/
	settings?: MerchantSettings | null;
	application_id?: string | null;
	pricing?: MerchantPricingTerms | null;
};
export type MerchantSettings = {
	/**
	* The object's type.
	*/
	object: "merchant_settings";
	/**
	* The ID of the merchant these settings belong to.
	*/
	merchant_id: string;
	address: Address;
	/**
	* The merchant's contact email address.
	*/
	contact_email: string | null;
	/**
	* The merchant's contact phone number.
	*/
	contact_phone: string | null;
	/**
	* The merchant's website URL.
	*/
	website: string | null;
	/**
	* The statement descriptor that appears on customer's credit card statements.
	*/
	statement_descriptor: string | null;
	/**
	* The prefix for invoice numbers.
	*/
	invoice_number_prefix: string | null;
	/**
	* The counter for invoice numbers.
	*/
	invoice_number_counter: number;
	customer_emails: CustomerEmails;
	/**
	* The merchant's accent color (hex code).
	*/
	accent_color: string | null;
	/**
	* The merchant's background color (hex code).
	*/
	background_color: string | null;
	/**
	* The merchant's brand logo file ID.
	*/
	brand_logo: string | null;
	/**
	* The merchant's brand icon file ID.
	*/
	brand_icon: string | null;
	/**
	* Invoice customization settings
	*/
	invoices: {
		fonts: {
			/**
			* Font family for invoice headings and titles
			*/
			display: "Inter" | "DM Sans" | "Lato" | "Public Sans" | "Open Sans" | "Plus Jakarta Sans" | "Work Sans" | "Source Sans 3" | "Poppins" | "Manrope" | "Lora" | "Libre Baskerville" | "Merriweather" | "Source Serif 4" | "Spectral" | "Fira Mono" | "IBM Plex Mono" | "JetBrains Mono" | "Roboto Mono" | "Source Code Pro";
			/**
			* Font family for invoice body text
			*/
			body: "Inter" | "DM Sans" | "Lato" | "Public Sans" | "Open Sans" | "Plus Jakarta Sans" | "Work Sans" | "Source Sans 3" | "Poppins" | "Manrope" | "Lora" | "Libre Baskerville" | "Merriweather" | "Source Serif 4" | "Spectral" | "Fira Mono" | "IBM Plex Mono" | "JetBrains Mono" | "Roboto Mono" | "Source Code Pro";
		};
	};
	/**
	* The payment method types enabled for checkout sessions. Checkout sessions created by this merchant will default to these types.
	*/
	enabled_payment_method_types: ("card" | "us_bank_account" | "apple_pay")[];
	/**
	* The dual pricing rate for invoice checkout sessions created without `dual_pricing`, as a percentage. For example, `3` represents 3%. Applies only to sessions for invoices that aren't for a subscription and that offer a payment method without the markup. `null` turns dual pricing off.
	*/
	default_dual_pricing_rate: number | null;
	/**
	* A link to the merchant's refund policy, shown on checkout pages.
	*/
	checkout_refund_policy_link: string | null;
	/**
	* A link to the merchant's shipping policy, shown on checkout pages.
	*/
	checkout_shipping_policy_link: string | null;
	/**
	* A link to the merchant's privacy policy, shown on checkout pages.
	*/
	checkout_privacy_policy_link: string | null;
	/**
	* A link to the merchant's terms of service, shown on checkout pages.
	*/
	checkout_terms_of_service_link: string | null;
	/**
	* A link back to the merchant's cart, shown on checkout pages so customers can return to edit their order.
	*/
	checkout_cart_link: string | null;
	/**
	* What happens to a subscription when retries for an unpaid renewal run out: `cancel` it, `pause` it, or `mark_unpaid`, which marks the invoice uncollectible and stops renewing until an invoice is paid.
	*/
	subscription_payment_failure_behavior: "cancel" | "pause" | "mark_unpaid";
	billing_portal: BillingPortalSettings;
	/**
	* Where customers sign in to the billing portal.
	*/
	billing_portal_url: string | null;
};
export type CustomerEmails = {
	/**
	* The email with a new invoice and its payment link.
	*/
	invoice_notification: boolean;
	/**
	* The receipt for a paid invoice.
	*/
	invoice_receipt: boolean;
	/**
	* The email with a new credit note.
	*/
	credit_note_notification: boolean;
	/**
	* The request to update the payment method when a renewal charge fails.
	*/
	subscription_payment_failed: boolean;
	/**
	* The notice 10 days before a bank account is debited a different amount.
	*/
	subscription_amount_change: boolean;
	/**
	* The reminder 30 days before each renewal of a plan billed less often than monthly.
	*/
	subscription_renewal_reminder: boolean;
	/**
	* The yearly reminder of what a monthly or shorter plan costs and how to cancel.
	*/
	subscription_annual_reminder: boolean;
	/**
	* The reminder before a subscription's free trial ends.
	*/
	subscription_trial_ending: boolean;
	/**
	* The copy of the recurring debit authorization the customer accepted.
	*/
	mandate_confirmation: boolean;
};
export type BillingPortalSettings = {
	/**
	* Whether customers can sign in to the billing portal with their email.
	*/
	enabled: boolean;
	/**
	* Whether customers can pause and resume subscriptions.
	*/
	pause: boolean;
	/**
	* Whether customers can skip a subscription's next renewal.
	*/
	skip: boolean;
	/**
	* Whether customers can switch a subscription to another of the prices in `prices`.
	*/
	change_plan: boolean;
	/**
	* Whether customers can change a subscription's quantity.
	*/
	change_quantity: boolean;
	/**
	* When a change to a cheaper plan or a shorter interval takes effect: `period_end`, `immediately` crediting the unused time, or `immediately_without_credit`. Upgrades apply now and charge the difference.
	*/
	downgrades: "period_end" | "immediately" | "immediately_without_credit";
	/**
	* The recurring prices customers can switch to. Customers can switch from prices outside this list.
	*/
	prices: string[];
};
export type PaymentDeclineCode = "authentication_required" | "debit_not_authorized" | "call_issuer" | "card_not_supported" | "card_velocity_exceeded" | "account_closed" | "currency_not_supported" | "do_not_honor" | "duplicate_transaction" | "expired_card" | "fraudulent" | "generic_decline" | "incorrect_cvc" | "incorrect_number" | "incorrect_postal_code" | "incorrect_address" | "insufficient_funds" | "invalid_account" | "issuer_not_available" | "lost_card" | "new_account_information_available" | "no_action_taken" | "no_account" | "not_permitted" | "offline_pin_required" | "online_or_offline_pin_required" | "pickup_card" | "pin_try_exceeded" | "processing_error" | "reenter_transaction" | "restricted_card" | "security_violation" | "service_not_allowed" | "stolen_card" | "stop_payment_order" | "transaction_not_allowed" | "try_again_later" | "withdrawal_count_limit_exceeded";
export type PaymentMethod = {
	/**
	* The object's type.
	*/
	object: "payment_method";
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* Whether the payment method is saved for future payments.
	*/
	active: boolean;
	allow_redisplay: PaymentMethodAllowRedisplay;
	/**
	* Billing details for the payment method.
	*/
	billing_details: {
		/**
		* The billing address.
		*/
		address: {
			/**
			* The city.
			*/
			city: string | null;
			/**
			* The country.
			*/
			country: CountryCode | null;
			/**
			* The first line of the address.
			*/
			line1: string | null;
			/**
			* The second line of the address, such as a unit or floor.
			*/
			line2: string | null;
			/**
			* The postal or ZIP code.
			*/
			postal_code: string | null;
			/**
			* The state or province.
			*/
			state: string | null;
		};
		/**
		* The billing name.
		*/
		name: string | null;
		/**
		* The billing email address.
		*/
		email: string | null;
	};
	/**
	* Present when `type` is `apple_pay`.
	*/
	apple_pay: Record<PropertyKey, never> | null;
	/**
	* The card, when `type` is `card`.
	*/
	card: Card | null;
	/**
	* The bank account, when `type` is `us_bank_account`.
	*/
	us_bank_account: UsBankAccount | null;
	/**
	* The type of payment method.
	*/
	type: "card" | "us_bank_account" | "apple_pay";
	/**
	* Expandable. The customer the payment method belongs to.
	*/
	customer: (string | Customer) | null;
};
export type PaymentMethodAllowRedisplay = "always" | "limited";
export type PaymentStatus = "requires_capture" | "processing" | "canceled" | "succeeded" | "failed";
export type Dispute = {
	/**
	* The object's type.
	*/
	object: "dispute";
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	status: DisputeStatus;
	/**
	* Whether you accepted the loss. An accepted dispute takes no evidence, and accepting doesn't change `status`.
	*/
	loss_accepted: boolean;
	/**
	* The disputed amount, in cents.
	*/
	amount: number;
	/**
	* Organization-specific revenue details. Included after allocation completes, including when the selected organization earned zero. Not included outside of an organization context or when no completed allocation applies.
	*/
	organization_revenue_details?: {
		/**
		* Whether organization revenue was allocated or terminally skipped for this source.
		*/
		outcome: "allocated" | "skipped";
		/**
		* Why organization revenue was skipped, or null when it was allocated.
		*/
		skip_reason: "commercial_terms_not_effective" | null;
		/**
		* The total residual revenue earned by the selected organization, in cents.
		*/
		amount: number;
		/**
		* The merchant fee components evaluated by the revenue allocation.
		*/
		fees: {
			type: "volume_fee" | "transaction_fee" | "monthly_fee" | "chargeback_fee";
			/**
			* The fee charged to the merchant, in cents.
			*/
			merchant_fee_amount: number;
			/**
			* The residual revenue earned by the selected organization, in cents.
			*/
			residual_amount: number;
		}[];
	};
	reason: DisputeReason;
	/**
	* Expandable. The disputed payment.
	*/
	payment: (string | Payment) | null;
	/**
	* Evidence you submit to contest the dispute.
	*/
	evidence: {
		/**
		* Activity logs showing the customer accessed or downloaded the digital product or service.
		*/
		access_activity_log: string | null;
		/**
		* The customer's billing address.
		*/
		billing_address: string | null;
		/**
		* Expandable. Your cancellation policy, as shown to the customer.
		*/
		cancellation_policy: (string | File) | null;
		/**
		* How and when the customer was shown your cancellation policy.
		*/
		cancellation_policy_disclosure: string | null;
		/**
		* Why the customer's subscription wasn't canceled.
		*/
		cancellation_rebuttal: string | null;
		/**
		* Expandable. Communication with the customer, such as emails showing they received or used the product.
		*/
		customer_communication: (string | File) | null;
		/**
		* The customer's email.
		*/
		customer_email: string | null;
		/**
		* The customer's name.
		*/
		customer_name: string | null;
		/**
		* The customer's IP address at purchase.
		*/
		customer_purchase_ip: string | null;
		/**
		* Expandable. A document or contract the customer signed.
		*/
		customer_signature: (string | File) | null;
		/**
		* Expandable. A document identifying the earlier charge, such as a receipt or shipping label.
		*/
		duplicate_charge_documentation: (string | File) | null;
		/**
		* How the disputed charge differs from the earlier one.
		*/
		duplicate_charge_explanation: string | null;
		/**
		* Expandable. The earlier payment the disputed charge appears to duplicate.
		*/
		duplicate_payment: (string | Payment) | null;
		/**
		* The kind of product or service sold.
		*/
		product_category: (("physical" | "digital" | "offline_service" | "event" | "booking") | string) | null;
		/**
		* The product or service sold.
		*/
		product_description: string | null;
		/**
		* Expandable. The receipt sent to the customer.
		*/
		receipt: (string | File) | null;
		/**
		* Expandable. Your refund policy, as shown to the customer.
		*/
		refund_policy: (string | File) | null;
		/**
		* How and when the customer was shown your refund policy.
		*/
		refund_policy_disclosure: string | null;
		/**
		* Why the customer isn't owed a refund.
		*/
		refund_refusal_explanation: string | null;
		/**
		* When the customer received or started receiving the service.
		*/
		service_date: string | null;
		/**
		* Expandable. Proof the service was provided, such as a signed contract or work order.
		*/
		service_documentation: (string | File) | null;
		/**
		* The address the product was shipped to.
		*/
		shipping_address: string | null;
		/**
		* The carriers that shipped the product, separated by commas.
		*/
		shipping_carrier: string | null;
		/**
		* When the product shipped.
		*/
		shipping_date: string | null;
		/**
		* Expandable. Proof the product shipped to the customer's address, such as a shipping label.
		*/
		shipping_documentation: (string | File) | null;
		/**
		* The shipment's tracking numbers, separated by commas.
		*/
		shipping_tracking_number: string | null;
		/**
		* Expandable. Your terms and conditions, as shown to the customer.
		*/
		terms_and_conditions: (string | File) | null;
		/**
		* Expandable. Any other evidence.
		*/
		uncategorized_file: (string | File) | null;
		/**
		* Any other evidence, as text.
		*/
		uncategorized_text: string | null;
		/**
		* Why you should win the dispute.
		*/
		win_reason: (("withdrawn" | "refunded" | "not_fraudulent") | string) | null;
	};
	/**
	* When evidence is due and when it was submitted.
	*/
	evidence_details: {
		/**
		* When your response is due.
		*/
		due_by: number;
		/**
		* When the evidence was submitted.
		*/
		submitted_at: number | null;
	};
	/**
	* Details for a card dispute or a returned bank debit.
	*/
	payment_method_details: {
		/**
		* `us_bank_account` for a bank debit returned after it succeeded. These disputes are created `lost` and take no evidence.
		*/
		type: "card" | "us_bank_account";
		/**
		* The card dispute, when `type` is `card`.
		*/
		card: {
			/**
			* Whether the dispute is an inquiry or a chargeback.
			*/
			case_type: "chargeback" | "inquiry";
			/**
			* The reason code from the card network.
			*/
			network_reason_code: string | null;
		} | null;
		/**
		* The returned debit, when `type` is `us_bank_account`.
		*/
		us_bank_account: {
			/**
			* The Nacha return code, such as `R10`.
			*/
			return_code: string | null;
		} | null;
	};
	metadata: Metadata;
};
export type DisputeStatus = "needs_response" | "under_review" | "won" | "lost";
export type DisputeReason = "credit_not_processed" | "duplicate" | "fraudulent" | "product_not_received" | "product_unacceptable" | "subscription_canceled" | "unrecognized" | "authorization_error" | "incorrect_amount" | "late_presentment" | "paid_by_other_means" | "general" | "insufficient_funds";
export type File = {
	/**
	* The object's type.
	*/
	object: "file";
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean | null;
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* The name of the file.
	*/
	name: string;
	/**
	* The file's intended use.
	*/
	purpose: FilePurpose;
	/**
	* The size of the file in bytes.
	*/
	size: number;
};
export type FilePurpose = "dispute_evidence" | "invoice_attachment" | "product_image" | "#ticket_attachment" | "#application_document" | "#processing_statement" | "#signed_document" | "#signing_certificate" | "#brand_asset" | "#assistant_attachment" | "#note_attachment";
export type Invoice = {
	/**
	* The object's type.
	*/
	object: "invoice";
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* When the object was last updated, in milliseconds since the Unix epoch.
	*/
	updated_at: number;
	/**
	* The billing address for the invoice.
	*/
	billing_address: Address;
	/**
	* Expandable. The customer associated with the invoice.
	*/
	customer: string | Customer;
	metadata: Metadata;
	/**
	* Expandable. The payments associated with the invoice.
	*/
	payments: (Payment[] | null) | null;
	/**
	* Expandable. The line items included in this invoice.
	*/
	line_items: LineItem[] | null;
	/**
	* Expandable. Discounts applied to the invoice as a whole.
	*/
	discounts: AppliedDiscount[] | null;
	/**
	* The invoice number.
	*/
	number: string;
	/**
	* Where the invoice's order ships.
	*/
	shipping_details: ShippingDetails;
	status: InvoiceStatus;
	collection_method: InvoiceCollectionMethod;
	/**
	* The subscription this invoice bills, if any.
	*/
	subscription: string | null;
	billing_reason: InvoiceBillingReason;
	/**
	* The saved payment method charged when the invoice is collected automatically. When null, the customer's `default_payment_method` is charged.
	*/
	default_payment_method: string | null;
	/**
	* The number of automatic payment attempts made on the invoice.
	*/
	attempt_count: number;
	/**
	* When the next automatic payment attempt will run, as a Unix timestamp in milliseconds. Null when none is scheduled.
	*/
	next_attempt_at: number | null;
	/**
	* The due date for the invoice as a Unix timestamp in milliseconds.
	*/
	due_at: number | null;
	/**
	* The number of days after finalization that the invoice is due.
	*/
	days_until_due: number | null;
	/**
	* The default taxes used for line items without their own taxes.
	*/
	default_taxes: {
		/**
		* The tax rate as a percentage.
		* @min 0
		* @max 100
		*/
		percentage: number;
		/**
		* The tax's name, such as "CA Sales Tax".
		*/
		display_name: string;
	}[] | null;
	/**
	* The amount of the invoice after discounts and before taxes.
	*/
	subtotal: number;
	/**
	* The total amount of all taxes on the invoice.
	*/
	tax_total: number;
	/**
	* The total amount of the invoice after discounts and taxes.
	*/
	total: number;
	/**
	* What the invoice bills: `total` less `balance_applied` and credit notes' `pre_payment_amount`.
	*/
	amount_billed: number;
	/**
	* How much of the customer's balance the invoice applied when it was finalized. Negative when it collects what the customer owed.
	*/
	balance_applied: number;
	/**
	* The amount succeeded payments received. A bank debit counts once it settles.
	*/
	amount_paid: number;
	/**
	* What's left to pay: `amount_billed` less succeeded and processing payments. `0` unless the invoice is `draft` or `open`.
	* @min 0
	*/
	amount_remaining: number;
	/**
	* The external system record linked to this invoice, if any.
	*/
	external_sync: ExternalSync | null;
	/**
	* Expandable. Files related to the invoice that are shown to the customer.
	*/
	attachments: (File[] | null) | null;
	/**
	* Expandable. The credit notes issued against this invoice.
	*/
	credit_notes: (CreditNote[] | null) | null;
	/**
	* A memo displayed on the invoice.
	*/
	memo: string | null;
	/**
	* Footer text displayed on the invoice.
	*/
	footer: string | null;
	/**
	* Label-value pairs displayed on the invoice.
	*/
	custom_fields: {
		[key: string]: any;
	} | null;
	/**
	* The URL of the hosted payment page for this invoice.
	*/
	payment_url: string | null;
};
export type LineItem = {
	/**
	* The object's type.
	*/
	object: "line_item";
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* When the object was last updated, in milliseconds since the Unix epoch.
	*/
	updated_at: number;
	type: LineItemType;
	/**
	* The quantity of the line item.
	*/
	quantity: number;
	/**
	* The name of a line item without a product.
	*/
	name: string | null;
	/**
	* The line item's description.
	*/
	description: string | null;
	/**
	* The unit amount in cents when the line item was created.
	*/
	unit_amount: number | null;
	/**
	* Expandable. The price of a `catalog` line item.
	*/
	price: (string | Price) | null;
	/**
	* Expandable. The product this line item bills, if any.
	*/
	product: (string | Product) | null;
	/**
	* Expandable. Discounts on this line item only.
	*/
	discounts: AppliedDiscount[] | null;
	/**
	* The taxes applied to this line item.
	*/
	taxes: {
		/**
		* The tax rate as a percentage.
		* @min 0
		* @max 100
		*/
		percentage: number;
		/**
		* The tax's name, such as "CA Sales Tax".
		*/
		display_name: string;
	}[];
	/**
	* The tax charged on this line item, per tax, including the invoice's default taxes.
	*/
	tax_amounts: TaxAmount[];
	/**
	* The amount after discounts, before tax, in cents.
	*/
	subtotal: number;
	/**
	* The amount after discounts and tax, in cents.
	*/
	total: number;
	/**
	* The period a subscription line item bills for.
	*/
	period: {
		/**
		* Start of the billed period, as a Unix timestamp in milliseconds.
		*/
		start: number;
		/**
		* End of the billed period, as a Unix timestamp in milliseconds.
		*/
		end: number;
	} | null;
	/**
	* The subscription item this line item bills, if any.
	*/
	subscription_item: string | null;
};
export type LineItemType = "custom" | "catalog";
export type Price = {
	/**
	* The object's type.
	*/
	object: "price";
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* When the object was last updated, in milliseconds since the Unix epoch.
	*/
	updated_at: number;
	/**
	* Whether the price has been deleted.
	*/
	deleted: boolean;
	/**
	* Expandable. The product this price is for.
	*/
	product: string | Product;
	/**
	* Whether the price can be used for new purchases.
	*/
	active: boolean;
	/**
	* An internal name for the price.
	*/
	name: string | null;
	/**
	* The amount in cents.
	* @min 0
	*/
	amount: number;
	/**
	* `one_time` for a single purchase, or `recurring` for a subscription.
	*/
	type: "one_time" | "recurring";
	/**
	* The billing period of a `recurring` price.
	*/
	recurring: PriceRecurring | null;
	metadata: Metadata;
};
export type Product = {
	/**
	* The object's type.
	*/
	object: "product";
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* When the object was last updated, in milliseconds since the Unix epoch.
	*/
	updated_at: number;
	/**
	* Whether the product has been deleted.
	*/
	deleted: boolean;
	/**
	* The product's name.
	*/
	name: string;
	/**
	* The product's description.
	*/
	description: string | null;
	/**
	* The product's stock keeping unit (SKU).
	*/
	sku: string | null;
	attributes: ProductAttributes;
	/**
	* Whether the product can be used for new purchases.
	*/
	active: boolean;
	/**
	* The Shopify product variant this product syncs from. While the store is connected, only the product's `metadata` can be updated.
	*/
	source: {
		type: "shopify";
		/**
		* The Shopify product variant ID.
		*/
		external_id: string;
		/**
		* The Shopify product ID.
		*/
		parent_external_id: string;
		/**
		* The Shopify store's domain.
		*/
		store_domain: string;
		/**
		* Whether the store is connected to Bias.
		*/
		connected: boolean;
	} | null;
	/**
	* Expandable. The price the dashboard shows for this product. The first active price added becomes the default.
	*/
	default_price: (string | Price) | null;
	/**
	* Expandable. The prices available for this product.
	*/
	prices: (Price[] | null) | null;
	/**
	* Images of this product.
	*/
	images: File[] | null;
	metadata: Metadata;
};
export type ProductAttributes = {
	[key: string]: any;
};
export type PriceRecurring = {
	interval: RecurringInterval;
	/**
	* The number of intervals in each billing period. For example, `interval: month` with `interval_count: 3` bills every three months.
	* @min 1
	*/
	interval_count: number;
};
export type RecurringInterval = "day" | "week" | "month" | "year";
export type AppliedDiscount = {
	/**
	* The object's type.
	*/
	object: "applied_discount";
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* Expandable. The discount this was applied from.
	*/
	discount: (string | Discount) | null;
	/**
	* The code the customer entered, or `null` when it was applied without one.
	*/
	code: string | null;
	/**
	* What the discount applies to. Only discounts from a connected Shopify store apply to `shipping`.
	*/
	target: "line_items" | "shipping";
	/**
	* Expandable. The customer the discount was applied for.
	*/
	customer: (string | Customer) | null;
	/**
	* The discount's name when it was applied.
	*/
	name: string;
	/**
	* The amount off in cents when the discount was applied.
	*/
	amount_off: number | null;
	/**
	* The percentage off when the discount was applied.
	*/
	percent_off: number | null;
};
export type Discount = {
	/**
	* The object's type.
	*/
	object: "discount";
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* When the object was last updated, in milliseconds since the Unix epoch.
	*/
	updated_at: number;
	/**
	* Whether the discount has been deleted.
	*/
	deleted: boolean;
	/**
	* The discount's name as shown to customers.
	*/
	name: string;
	/**
	* The code customers enter to redeem the discount. Case insensitive.
	*/
	code: string | null;
	/**
	* Whether customers can redeem the code.
	*/
	active: boolean;
	/**
	* The amount off, in cents.
	*/
	amount_off: number | null;
	/**
	* The percentage off, such as `15` for 15%.
	*/
	percent_off: number | null;
	/**
	* When the code expires, in milliseconds since the Unix epoch.
	*/
	expires_at: number | null;
	/**
	* How many times the code can be redeemed.
	*/
	max_redemptions: number | null;
	/**
	* How many times the code has been redeemed.
	* @min 0
	*/
	times_redeemed: number;
	/**
	* The smallest order, before discounts, the code applies to, in cents.
	*/
	minimum_amount: number | null;
	/**
	* Whether the code works only on a customer's first purchase.
	*/
	first_purchase_only: boolean;
	/**
	* Whether each customer can redeem the code only once.
	*/
	once_per_customer: boolean;
	/**
	* Expandable. The products the discount applies to, or an empty list for all products.
	*/
	applies_to: (Product[] | null) | null;
	metadata: Metadata;
};
export type TaxAmount = {
	/**
	* The tax charged, in cents.
	*/
	amount: number;
	/**
	* The amount taxed, in cents.
	*/
	taxable_amount: number;
	/**
	* The tax's name.
	*/
	display_name: string;
	/**
	* The tax rate as a percentage, or `null` for a tax without a rate.
	*/
	percentage: number | null;
};
export type InvoiceStatus = "draft" | "open" | "paid" | "uncollectible" | "void";
export type InvoiceCollectionMethod = "charge_automatically" | "send_invoice";
export type InvoiceBillingReason = "manual" | "subscription_create" | "subscription_cycle" | "subscription_update";
export type CreditNote = {
	/**
	* The object's type.
	*/
	object: "credit_note";
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* When the object was last updated, in milliseconds since the Unix epoch.
	*/
	updated_at: number;
	/**
	* Expandable. The invoice this credit note credits.
	*/
	invoice: string | Invoice;
	/**
	* Expandable. The customer of the credited invoice.
	*/
	customer: string | Customer;
	status: CreditNoteStatus;
	reason: CreditNoteReason;
	/**
	* Expandable. The line items included in this credit note.
	*/
	line_items: CreditNoteLineItem[] | null;
	/**
	* The sum of the line items' subtotals, before tax.
	*/
	subtotal: number;
	/**
	* The tax credited.
	*/
	tax_total: number;
	/**
	* The total credited, including taxes. Sum of `pre_payment_amount`, `refund_amount`, `credit_amount` and `out_of_band_amount`.
	*/
	total: number;
	/**
	* The part that lowers what's owed on the invoice.
	*/
	pre_payment_amount: number;
	/**
	* The part refunded to the invoice's payments.
	*/
	refund_amount: number;
	/**
	* The part added to the customer's balance.
	*/
	credit_amount: number;
	/**
	* The part settled outside Bias.
	*/
	out_of_band_amount: number;
	/**
	* The refunds that settle `refund_amount`.
	*/
	refunds: CreditNoteRefund[];
	/**
	* A memo shown in the credit note email.
	*/
	memo: string | null;
	metadata: Metadata;
};
export type CreditNoteStatus = "issued" | "void";
export type CreditNoteReason = "proration" | "duplicate" | "order_change" | "product_unsatisfactory" | "other";
export type CreditNoteLineItem = {
	/**
	* The object's type.
	*/
	object: "credit_note_line_item";
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* The line's display name.
	*/
	name: string;
	/**
	* The line's description.
	*/
	description: string | null;
	/**
	* The unit amount credited in cents, before tax.
	*/
	unit_amount: number;
	/**
	* The quantity credited.
	*/
	quantity: number;
	/**
	* The tax rates applied to the line.
	*/
	taxes: {
		/**
		* The tax rate as a percentage.
		* @min 0
		* @max 100
		*/
		percentage: number;
		/**
		* The tax's name, such as "CA Sales Tax".
		*/
		display_name: string;
	}[];
	/**
	* The tax credited on the line.
	*/
	tax_amounts: TaxAmount[];
	/**
	* The invoice line item this line credits, if any.
	*/
	line_item: string | null;
	/**
	* The period of service the line credits, if any.
	*/
	period: {
		/**
		* Start of the credited period, as a Unix timestamp in milliseconds.
		*/
		start: number;
		/**
		* End of the credited period, as a Unix timestamp in milliseconds.
		*/
		end: number;
	} | null;
	/**
	* `unit_amount` × `quantity`, before tax.
	*/
	subtotal: number;
	/**
	* The line's total in cents, with tax.
	*/
	total: number;
};
export type CreditNoteRefund = {
	/**
	* The refund the credit was paid out with.
	*/
	refund: string;
	/**
	* The amount refunded, in cents.
	*/
	amount: number;
};
export type SessionMode = "payment" | "setup" | "subscription";
export type SessionStatus = "open" | "expired" | "complete";
export type SessionSubmitLabel = "auto" | "book" | "donate" | "pay" | "subscribe";
export type LineItemPriceData = {
	/**
	* The ID of the [product](/api/products) to bill at `unit_amount`. Exactly one of `product` or `name` is required.
	*/
	product?: string | null;
	/**
	* The name of a line item without a product.
	*/
	name?: string | null;
	/**
	* The line item's description.
	*/
	description?: string | null;
	/**
	* The unit amount in cents.
	* @min 0
	* @max 2147483647
	*/
	unit_amount: number;
};
export type ShippingAddressCollectionInput = boolean | {
	allowed_countries?: CountryCode[];
};
export type BillingDetailsCollectionInput = boolean | {
	/**
	* Whether checkout collects the billing name.
	*/
	name?: boolean;
	/**
	* Whether checkout collects the full billing address. Card payments collect the billing country and postal code either way.
	*/
	address?: boolean;
};
export type MetadataInput = {
	[key: string]: any;
};
export type CheckoutSessionExpand = {
	payments?: (boolean | PaymentExpand) | null;
	customer?: (boolean | CustomerExpand) | null;
	invoice?: (boolean | InvoiceExpand) | null;
	line_items?: (boolean | LineItemExpand) | null;
	discounts?: (boolean | AppliedDiscountExpand) | null;
	shipping_cost?: {
		shipping_rate?: boolean | null;
	} | null;
	shipping_options?: {
		shipping_rate?: boolean | null;
	} | null;
};
export type PaymentExpand = {
	customer?: (boolean | CustomerExpand) | null;
	merchant?: (boolean | MerchantExpand) | null;
	dispute?: (boolean | DisputeExpand) | null;
	invoice?: (boolean | InvoiceExpand) | null;
	payment_method?: (boolean | {
		customer?: (boolean | CustomerExpand) | null;
	}) | null;
	session?: (boolean | CheckoutSessionExpand) | null;
};
export type CustomerExpand = Record<PropertyKey, never>;
export type MerchantExpand = {
	settings?: boolean | null;
};
export type DisputeExpand = {
	/**
	* Expands all evidence fields.
	*/
	evidence?: boolean | null;
	payment?: (boolean | PaymentExpand) | null;
};
export type InvoiceExpand = {
	customer?: (boolean | CustomerExpand) | null;
	payments?: (boolean | PaymentExpand) | null;
	line_items?: (boolean | LineItemExpand) | null;
	discounts?: (boolean | AppliedDiscountExpand) | null;
	attachments?: (boolean | FileExpand) | null;
	credit_notes?: (boolean | CreditNoteExpand) | null;
};
export type LineItemExpand = {
	product?: (boolean | ProductExpand) | null;
	price?: (boolean | PriceExpand) | null;
	discounts?: (boolean | AppliedDiscountExpand) | null;
};
export type ProductExpand = {
	images?: (boolean | FileExpand) | null;
	default_price?: (boolean | PriceExpand) | null;
	prices?: (boolean | PriceExpand) | null;
};
export type FileExpand = Record<PropertyKey, never>;
export type PriceExpand = {
	product?: (boolean | ProductExpand) | null;
};
export type AppliedDiscountExpand = {
	discount?: (boolean | DiscountExpand) | null;
	customer?: (boolean | CustomerExpand) | null;
};
export type DiscountExpand = {
	applies_to?: (boolean | ProductExpand) | null;
};
export type CreditNoteExpand = {
	invoice?: (boolean | InvoiceExpand) | null;
	customer?: (boolean | CustomerExpand) | null;
	line_items?: boolean | null;
};
export type DiscountInput = {
	/**
	* The ID of the discount to apply.
	*/
	discount?: string;
	/**
	* A discount code to redeem. Case insensitive.
	*/
	code?: string;
};
export type CustomerBalanceTransaction = {
	/**
	* The object's type.
	*/
	object: "customer_balance_transaction";
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* Expandable. The customer whose balance changed.
	*/
	customer: string | Customer;
	type: CustomerBalanceTransactionType;
	/**
	* The change in cents: positive adds credit, negative adds an amount owed.
	*/
	amount: number;
	/**
	* The customer's balance in cents after this transaction.
	*/
	ending_balance: number;
	/**
	* Expandable. The invoice that applied or gave back the balance, for `invoice_applied` and `invoice_reversed`.
	*/
	invoice: (string | Invoice) | null;
	/**
	* Expandable. The credit note the transaction came from, if any.
	*/
	credit_note: (string | CreditNote) | null;
	/**
	* Expandable. The refund that failed, for `refund_failed`, or paid out the credit, for `credit_refunded`.
	*/
	refund: (string | Refund) | null;
	/**
	* An internal note.
	*/
	description: string | null;
	metadata: Metadata;
};
export type CustomerBalanceTransactionType = "adjustment" | "credit_note" | "credit_note_void" | "invoice_applied" | "invoice_reversed" | "refund_failed" | "credit_refunded";
export type Refund = {
	/**
	* The object's type.
	*/
	object: "refund";
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* The amount refunded, in cents.
	*/
	amount: number;
	/**
	* The fees on the refund, in cents. Each is `null` until it's known.
	*/
	fees: {
		/**
		* The interchange credited back for the refund.
		*/
		interchange: number | null;
		/**
		* The platform fee.
		*/
		platform: number | null;
		/**
		* The total of the refund's fees.
		*/
		total: number | null;
	};
	/**
	* Why a `failed` refund failed.
	*/
	failed_reason: string | null;
	/**
	* Expandable. The refunded payment.
	*/
	payment: string | Payment;
	status: RefundStatus;
};
export type RefundStatus = "failed" | "pending" | "succeeded";
export type Organization = {
	/**
	* The object's type.
	*/
	object: "organization";
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* Whether the organization has been deleted.
	*/
	deleted: boolean;
	name: string;
	active: boolean;
	/**
	* Flags that change which features this organization has. `gateway_merchants` organizations can board gateway merchants.
	*/
	flags: "gateway_merchants"[];
	kind: "partner" | "referral" | "enterprise";
	/**
	* The current user's role in the organization, direct or inherited. `null` when not resolved for the current user.
	*/
	role: ("admin" | "manager" | "viewer") | null;
	/**
	* What the current user may do to the organization's merchants. `null` when not resolved for the current user.
	*/
	merchant_access: ("read" | "operate" | "full") | null;
	/**
	* Expandable. The organization's direct parent.
	*/
	parent: (string | Organization) | null;
};
export type EventExpand = {
	request?: (boolean | RequestExpand) | null;
};
export type RequestExpand = {
	api_key?: (boolean | ApiKeyExpand) | null;
	dashboard_user?: boolean | null;
};
export type DashboardUser = {
	/**
	* The object's type.
	*/
	object: "dashboard_user";
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	email: string;
	merchants: Merchant[] | null;
	organizations: Organization[] | null;
	name: string | null;
	phone: string | null;
	entitlements: string[];
	impersonating?: boolean;
};
export type Request = {
	/**
	* The object's type.
	*/
	object: "request";
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean | null;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	url: string;
	/**
	* The API operation, such as `["customers", "create"]`.
	*/
	resource_path: string[] | null;
	request: {
		body: {
			[key: string]: any;
		} | null;
		/**
		* The request headers, without `Authorization` or `Cookie`.
		*/
		headers: {
			[key: string]: any;
		};
		/**
		* The IP address the request came from.
		*/
		ip: string;
	};
	response: {
		body: {
			[key: string]: any;
		} | null;
		headers: {
			[key: string]: any;
		} | null;
		/**
		* The HTTP status code.
		*/
		status: number | null;
	};
	/**
	* Expandable. The API key that made the request.
	*/
	api_key: (string | ApiKey) | null;
	/**
	* Expandable. The dashboard user who made the request.
	*/
	dashboard_user: (string | DashboardUser) | null;
};
export type EventContext = {
	/**
	* The email address the invoice was sent to.
	*/
	recipient_email: string;
} | ApplicationEventContext;
export type ApplicationEventContext = {
	actor_kind: "organization_user" | "applicant" | "global_admin" | "public_user" | "system" | "customer";
	actor_user_id?: string | null;
	recipient_email?: string;
};
export type Event = {
	/**
	* The object's type.
	*/
	object: "event";
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* The object before the event, for events that change an existing object.
	*/
	previous_state: (CheckoutSession | CreditNote | Customer | CustomerBalanceTransaction | Discount | AppliedDiscount | Dispute | File | Invoice | Payment | PaymentMethod | Price | Product | Refund | ShippingRate | Subscription | Mandate) | null;
	/**
	* The object after the event.
	*/
	state: (CheckoutSession | CreditNote | Customer | CustomerBalanceTransaction | Discount | AppliedDiscount | Dispute | File | Invoice | Payment | PaymentMethod | Price | Product | Refund | ShippingRate | Subscription | Mandate) | null;
	/**
	* Expandable. The request that caused the event.
	*/
	request: (string | Request) | null;
	type: EventType;
	/**
	* Details about the event, such as the email address an invoice was sent to.
	*/
	context: EventContext | null;
};
export type Subscription = {
	/**
	* The object's type.
	*/
	object: "subscription";
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* When the object was last updated, in milliseconds since the Unix epoch.
	*/
	updated_at: number;
	/**
	* Expandable. The customer who is subscribed.
	*/
	customer: string | Customer;
	status: SubscriptionStatus;
	/**
	* The prices the subscription bills each period.
	*/
	items: SubscriptionItem[];
	/**
	* The saved payment method charged for renewals. When null, the customer's `default_payment_method` is charged.
	*/
	default_payment_method: string | null;
	collection_method: InvoiceCollectionMethod;
	/**
	* For `send_invoice` subscriptions, the number of days the customer has to pay each invoice.
	*/
	days_until_due: number | null;
	/**
	* The taxes applied to each invoice.
	*/
	default_taxes: {
		/**
		* The tax rate as a percentage.
		* @min 0
		* @max 100
		*/
		percentage: number;
		/**
		* The tax's name, such as "CA Sales Tax".
		*/
		display_name: string;
	}[];
	/**
	* When billing periods are counted from, as a Unix timestamp in milliseconds. Renewals fall on the anchor's day and time in UTC.
	*/
	billing_cycle_anchor_at: number;
	/**
	* When the subscription next renews, as a Unix timestamp in milliseconds. Null when it won't renew.
	*/
	next_renewal_at: number | null;
	/**
	* When the trial started, as a Unix timestamp in milliseconds.
	*/
	trial_start_at: number | null;
	/**
	* When the trial ends and the first paid period starts, as a Unix timestamp in milliseconds.
	*/
	trial_end_at: number | null;
	/**
	* When the subscription is scheduled to be canceled, as a Unix timestamp in milliseconds. Null once it's canceled.
	*/
	cancel_at: number | null;
	/**
	* Whether the subscription cancels at the end of its current period.
	*/
	cancel_at_period_end: boolean;
	/**
	* When the subscription was canceled or scheduled to be canceled, as a Unix timestamp in milliseconds.
	*/
	canceled_at: number | null;
	/**
	* When a canceled subscription ended, as a Unix timestamp in milliseconds.
	*/
	ended_at: number | null;
	cancellation_details: SubscriptionCancellationDetails;
	/**
	* For an `incomplete` subscription, when it's canceled if its first invoice still isn't paid, as a Unix timestamp in milliseconds.
	*/
	incomplete_expires_at: number | null;
	/**
	* For a `past_due` subscription, when payment retries stop, as a Unix timestamp in milliseconds.
	*/
	payment_retries_end_at: number | null;
	/**
	* When a paused subscription resumes on its own, as a Unix timestamp in milliseconds. Null for a pause with no end.
	*/
	resumes_at: number | null;
	/**
	* Expandable. The most recent invoice for this subscription.
	*/
	latest_invoice: (string | Invoice) | null;
	/**
	* Where each period's order is shipped.
	*/
	shipping_details: ShippingDetails | null;
	/**
	* The shipping charged each period.
	*/
	shipping_cost: SubscriptionShippingCost | null;
	pending_change: SubscriptionPendingChange | null;
	metadata: Metadata;
};
export type SubscriptionStatus = "incomplete" | "trialing" | "active" | "past_due" | "paused" | "unpaid" | "canceled";
export type SubscriptionItem = {
	/**
	* The object's type.
	*/
	object: "subscription_item";
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* The subscription this item belongs to.
	*/
	subscription: string;
	price: Price;
	/**
	* The quantity billed.
	* @min 1
	*/
	quantity: number;
	/**
	* The item's current billing period.
	*/
	current_period: {
		/**
		* Start of the current billing period, as a Unix timestamp in milliseconds.
		*/
		start: number;
		/**
		* End of the current billing period, as a Unix timestamp in milliseconds.
		*/
		end: number;
	};
	metadata: Metadata;
};
export type SubscriptionCancellationDetails = {
	reason: SubscriptionCancellationReason | null;
	feedback: SubscriptionCancellationFeedback | null;
	/**
	* The customer's comment on why they're canceling.
	*/
	comment: string | null;
};
export type SubscriptionCancellationReason = "cancellation_requested" | "payment_failed" | "incomplete_expired";
export type SubscriptionCancellationFeedback = "too_expensive" | "unused" | "switched_service" | "missing_features" | "low_quality" | "customer_service" | "too_complex" | "other";
export type SubscriptionShippingCost = {
	/**
	* The shipping rate the amount was quoted from, if any.
	*/
	shipping_rate: string | null;
	/**
	* The shipping option's name, as the customer sees it.
	*/
	display_name: string | null;
	/**
	* The shipping charged each period, in cents.
	*/
	amount: number;
};
export type SubscriptionPendingChange = {
	/**
	* The items the subscription renews with.
	*/
	items: {
		/**
		* The price the item renews at.
		*/
		price: string;
		/**
		* The quantity the item renews at.
		*/
		quantity: number;
	}[];
	/**
	* When the change takes effect, as a Unix timestamp in milliseconds. Null while the subscription isn't renewing.
	*/
	effective_at: number | null;
};
export type Mandate = {
	/**
	* The object's type.
	*/
	object: "mandate";
	/**
	* `true` if the object is live, or `false` if it's in a sandbox.
	*/
	live: boolean;
	/**
	* Unique identifier for the object.
	*/
	id: string;
	/**
	* When the object was created, in milliseconds since the Unix epoch.
	*/
	created_at: number;
	/**
	* The bank account the customer authorized debits from.
	*/
	payment_method: string;
	/**
	* The customer the bank account belongs to.
	*/
	customer: string | null;
	status: MandateStatus;
	/**
	* Always `multi_use`: the mandate covers later debits, such as subscription renewals.
	*/
	type: "multi_use" | "single_use";
	/**
	* Proof that the customer authorized the debits.
	*/
	customer_acceptance: {
		/**
		* `online` if the customer accepted on a website or app, or `offline` if you collected the authorization another way, such as in writing.
		*/
		type: "online" | "offline";
		/**
		* When the customer authorized the debits.
		*/
		accepted_at: number;
		/**
		* The customer's IP address, for `online` acceptance.
		*/
		ip_address: string | null;
		/**
		* The customer's browser user agent, for `online` acceptance.
		*/
		user_agent: string | null;
	};
	/**
	* The authorization the customer agreed to.
	*/
	authorization_text: string;
	/**
	* For a `replaced` mandate, the mandate that replaced it.
	*/
	replaced_by: string | null;
};
export type MandateStatus = "active" | "revoked" | "replaced";
export type EventType = "customer.created" | "customer.updated" | "customer.deleted" | "payment.created" | "payment.updated" | "payment.amount_capturable_updated" | "payment.succeeded" | "payment.canceled" | "payment.failed" | "payment_method.created" | "payment_method.updated" | "payment_method.deactivated" | "refund.created" | "refund.updated" | "refund.succeeded" | "refund.failed" | "file.created" | "file.updated" | "dispute.created" | "dispute.updated" | "checkout_session.created" | "checkout_session.updated" | "checkout_session.completed" | "checkout_session.expired" | "product.created" | "product.updated" | "product.deleted" | "price.created" | "price.updated" | "discount.created" | "discount.updated" | "discount.deleted" | "applied_discount.created" | "applied_discount.deleted" | "invoice.created" | "invoice.updated" | "invoice.deleted" | "invoice.finalized" | "invoice.sent" | "invoice.reminder_sent" | "invoice.voided" | "invoice.paid" | "invoice.payment_failed" | "invoice.marked_uncollectible" | "credit_note.created" | "credit_note.updated" | "credit_note.voided" | "customer_balance_transaction.created" | "customer_balance_transaction.updated" | "shipping_rate.created" | "shipping_rate.updated" | "subscription.created" | "subscription.updated" | "subscription.trial_will_end" | "subscription.will_renew" | "subscription.past_due" | "subscription.paused" | "subscription.resumed" | "subscription.canceled" | "mandate.created" | "mandate.updated" | "mandate.revoked";
export type EventFilters = {
	/**
	* Filter by the event's creation date.
	*/
	created_at?: number | TimestampFilter | {
		or: TimestampFilter[];
	};
	/**
	* Filter by the ID of the object the event is about.
	*/
	for?: string | {
		eq?: string;
		not_eq?: string;
		in?: string[];
		not_in?: string[];
		exists?: boolean;
	} | {
		or: {
			eq?: string;
			not_eq?: string;
			in?: string[];
			not_in?: string[];
			exists?: boolean;
		}[];
	};
	/**
	* Filter by the type of object the event is about, such as `customer`.
	*/
	object?: EventObjectType | {
		eq?: EventObjectType;
		not_eq?: EventObjectType;
		in?: EventObjectType[];
		not_in?: EventObjectType[];
		exists?: boolean;
	} | {
		or: {
			eq?: EventObjectType;
			not_eq?: EventObjectType;
			in?: EventObjectType[];
			not_in?: EventObjectType[];
			exists?: boolean;
		}[];
	};
	/**
	* Filter by the event's type.
	*/
	type?: EventType | {
		eq?: EventType;
		not_eq?: EventType;
		in?: EventType[];
		not_in?: EventType[];
		exists?: boolean;
	} | {
		or: {
			eq?: EventType;
			not_eq?: EventType;
			in?: EventType[];
			not_in?: EventType[];
			exists?: boolean;
		}[];
	};
};
export type EventObjectType = "customer" | "payment" | "payment_method" | "refund" | "file" | "dispute" | "checkout_session" | "product" | "price" | "discount" | "applied_discount" | "invoice" | "credit_note" | "customer_balance_transaction" | "shipping_rate" | "subscription" | "mandate";
export type PaymentMethodCreate = PaymentMethodCardCreate | PaymentMethodCardEncrypted | PaymentMethodUsBankAccountCreate | PaymentMethodUsBankAccountEncrypted | PaymentMethodApplePayCreate;
export type PaymentMethodCardCreate = {
	billing_details?: PaymentMethodCreateBillingDetails;
	card: CardDetails;
	/**
	* Saves the payment method for future payments.
	*/
	setup_future_usage?: SetupFutureUsage | null;
	/**
	* Whether the payment method is offered to the customer at checkout and on invoice payment pages. Defaults to `limited`.
	*/
	allow_redisplay?: PaymentMethodAllowRedisplay;
};
export type PaymentMethodCreateBillingDetails = {
	/**
	* The billing name.
	*/
	name?: string | null;
	/**
	* The billing email address.
	*/
	email?: string | null;
	address?: PaymentMethodCreateBillingAddress;
};
export type PaymentMethodCreateBillingAddress = {
	line1?: string | null;
	line2?: string | null;
	city?: string | null;
	state?: string | null;
	postal_code?: string | null;
	/**
	* The country.
	*/
	country?: CountryCode | null;
};
export type CardDetails = {
	number: string;
	/**
	* @min 1
	* @max 12
	*/
	exp_month: number;
	/**
	* @min 2000
	*/
	exp_year: number;
	cvc: string;
};
export type SetupFutureUsage = "off_session" | "on_session";
export type PaymentMethodCardEncrypted = {
	billing_details?: PaymentMethodCreateBillingDetails;
	card: EncryptedCardDetails;
	/**
	* Saves the payment method for future payments.
	*/
	setup_future_usage?: SetupFutureUsage | null;
};
export type EncryptedCardDetails = {
	encrypted_number: string;
	encrypted_expiry: string;
	encrypted_cvc: string;
};
export type PaymentMethodUsBankAccountCreate = {
	billing_details?: PaymentMethodCreateBillingDetails;
	us_bank_account: UsBankAccountDetails;
	/**
	* Saves the payment method for future payments.
	*/
	setup_future_usage?: SetupFutureUsage | null;
	/**
	* Whether the payment method is offered to the customer at checkout and on invoice payment pages. Defaults to `limited`.
	*/
	allow_redisplay?: PaymentMethodAllowRedisplay;
};
export type UsBankAccountDetails = {
	account_number: string;
	routing_number: string;
	account_type: "checking" | "savings";
	/**
	* Whether the account belongs to a person or a business. Defaults to `individual`.
	*/
	account_holder_type?: "individual" | "company";
};
export type PaymentMethodUsBankAccountEncrypted = {
	billing_details?: PaymentMethodCreateBillingDetails;
	us_bank_account: EncryptedUsBankAccountDetails;
	/**
	* Saves the payment method for future payments.
	*/
	setup_future_usage?: SetupFutureUsage | null;
};
export type EncryptedUsBankAccountDetails = {
	encrypted_account_number: string;
	encrypted_routing_number: string;
	account_type: "checking" | "savings";
	/**
	* Whether the account belongs to a person or a business. Defaults to `individual`.
	*/
	account_holder_type?: "individual" | "company";
};
export type PaymentMethodApplePayCreate = {
	billing_details?: PaymentMethodCreateBillingDetails;
	apple_pay: ApplePayDetails;
};
export type ApplePayDetails = {
	payment_data: ApplePayPaymentData;
};
export type ApplePayPaymentData = {
	version: "EC_v1";
	data: string;
	signature: string;
	header: {
		ephemeralPublicKey: string;
		publicKeyHash: string;
		transactionId: string;
		applicationData?: string;
	};
};
export type PaymentError = {
	/**
	* The object's type.
	*/
	object: "error";
	/**
	* Details about the error.
	*/
	error: {
		type: "payment_error";
		/**
		* `true` for a live request, `false` for a sandbox request, or `null` if the request wasn't authenticated as a merchant.
		*/
		live: boolean | null;
		code: null;
		/**
		* Why the payment was declined, as a [decline code](/api/decline-codes).
		*/
		decline_code: PaymentDeclineCode | null;
		/**
		* The decline code from the payment network.
		*/
		network_decline_code: string | null;
		/**
		* A message about the error, written for developers.
		*/
		message: string;
		/**
		* A message about the error that's safe to show to the customer.
		*/
		customer_message: string | null;
		/**
		* The request parameter the error relates to.
		*/
		param: string | null;
		/**
		* The declined payment.
		*/
		payment: Payment | null;
	};
};
export type CheckoutAddressAutocompleteParams = {
	input: string;
	/**
	* A two-letter ISO 3166-1 alpha-2 country code.
	*/
	country?: CountryCode;
};
export type CheckoutAddressValidateParams = {
	line1: string;
	city?: string;
	state?: string;
	postal_code?: string;
	country: CountryCode;
};
export type CheckoutWalletApplePayMerchantSessionParams = {
	validation_url: string;
};
export type CheckoutWalletApplePayUpdateParams = {
	checkout_session_updated_at: number;
	shipping_contact?: {
		givenName?: string;
		familyName?: string;
		emailAddress?: string;
		phoneNumber?: string;
		addressLines?: string[];
		locality?: string;
		administrativeArea?: string;
		postalCode?: string;
		countryCode?: string;
	};
	shipping_rate?: string;
	/**
	* @default false
	*/
	final?: boolean;
	billing_contact?: {
		givenName?: string;
		familyName?: string;
		emailAddress?: string;
		phoneNumber?: string;
		addressLines?: string[];
		locality?: string;
		administrativeArea?: string;
		postalCode?: string;
		countryCode?: string;
	};
};
export type CheckoutWalletConfigurationParams = Record<PropertyKey, never>;
export type CheckoutSessionGetParams = {
	expand?: CheckoutSessionExpand;
};
export type CheckoutSessionUpdateParams = {
	expand?: CheckoutSessionExpand;
} & {
	/**
	* Whether the customer can enter discount codes.
	*/
	allow_discount_codes?: boolean;
	/**
	* What the customer is buying, replacing the current line items. Include an existing line item's `id` to keep or change it.
	*/
	line_items?: {
		/**
		* The ID of an existing line item to keep or change. Omit it to add a line item.
		*/
		id?: string;
		/**
		* The ID of the [price](/api/prices) to use for this line item. Exactly one of `price` or `price_data` is required.
		*/
		price?: string | null;
		price_data?: LineItemPriceData | null;
		/**
		* The quantity of the line item. Required for a new line item.
		*/
		quantity?: number | null;
		/**
		* Discounts or discount codes for this line item only.
		*/
		discounts?: DiscountInput[] | null;
	}[];
	/**
	* Discounts or discount codes for the whole session, replacing the current ones.
	*/
	discounts?: ({
		/**
		* The ID of the discount to apply.
		*/
		discount: string;
	} | {
		/**
		* A discount code to apply. Case insensitive.
		*/
		code: string;
	})[];
	/**
	* The session's customer.
	*/
	customer?: string;
	/**
	* The customer's contact details.
	*/
	customer_details?: {
		/**
		* The customer's email address.
		*/
		email?: string | null;
		/**
		* The customer's full name or business name.
		*/
		name?: string | null;
		/**
		* The customer's phone number.
		*/
		phone?: string | null;
	};
	/**
	* The name, phone and address the order ships to.
	*/
	shipping_details?: {
		name?: string | null;
		phone?: string | null;
		address?: {
			/**
			* The first line of the address.
			*/
			line1?: string | null;
			/**
			* The second line of the address, such as a unit or floor.
			*/
			line2?: string | null;
			/**
			* The city.
			*/
			city?: string | null;
			/**
			* The state or province.
			*/
			state?: string | null;
			/**
			* The postal or ZIP code.
			*/
			postal_code?: string | null;
			/**
			* The country.
			*/
			country?: CountryCode | null;
		};
	} | null;
	shipping_address_collection?: ShippingAddressCollectionInput | null;
	billing_details_collection?: BillingDetailsCollectionInput | null;
	/**
	* Whether checkout collects the customer's phone number. Sessions that collect a shipping address ask for it there and save it as the shipping phone too.
	*/
	phone_number_collection?: boolean;
	/**
	* The billing name and address.
	*/
	billing_details?: {
		name?: string | null;
		address?: {
			/**
			* The first line of the address.
			*/
			line1?: string | null;
			/**
			* The second line of the address, such as a unit or floor.
			*/
			line2?: string | null;
			/**
			* The city.
			*/
			city?: string | null;
			/**
			* The state or province.
			*/
			state?: string | null;
			/**
			* The postal or ZIP code.
			*/
			postal_code?: string | null;
			/**
			* The country.
			*/
			country?: CountryCode | null;
		};
	} | null;
	/**
	* The shipping options the customer can choose from, replacing the current ones. The first one is selected.
	*/
	shipping_options?: (string | {
		/**
		* The shipping rate's name, shown to customers.
		*/
		display_name: string;
		/**
		* The shipping cost, in cents.
		* @min 0
		* @max 2147483647
		*/
		amount: number;
		/**
		* How long delivery is estimated to take.
		*/
		delivery_estimate?: {
			maximum?: {
				unit: DeliveryEstimateUnit;
				value: number;
			} | null;
			minimum?: {
				unit: DeliveryEstimateUnit;
				value: number;
			} | null;
		} | null;
		metadata?: MetadataInput | null;
	})[] | null;
	/**
	* The shipping rate of the option the customer chose, or `null` to clear the choice.
	*/
	shipping_rate?: string | null;
	/**
	* Dual pricing on a one-off invoice's session that accepts bank payments. Card payments pay `total` plus `rate`, and bank payments pay `total`.
	*/
	dual_pricing?: {
		/**
		* The percentage card payments add, such as `3` for 3%.
		*/
		rate: number;
	} | null;
	/**
	* Your own [key-value data](/api/metadata) on the object.
	*/
	metadata?: MetadataInput | null;
};
export type CheckoutSessionDiscountCodeApplyParams = {
	expand?: CheckoutSessionExpand;
} & {
	/**
	* The discount code to apply.
	*/
	code: string;
};
export type CheckoutSessionDiscountCodeRemoveParams = {
	expand?: CheckoutSessionExpand;
};
export type EventListParams = {
	expand?: EventExpand;
	/**
	* The ID of the object to list before, for [pagination](/api/pagination).
	*/
	ending_before?: string;
	/**
	* The ID of the object to list after, for [pagination](/api/pagination).
	*/
	starting_after?: string;
	/**
	* The maximum number of objects to return, from 1 to 1000. Defaults to 50.
	* @min 1
	* @max 1000
	* @default 50
	*/
	limit?: number;
	/**
	* Streams matching events as they're created, as newline-separated event objects.
	*/
	stream?: boolean;
	/**
	* [Filters](/api/filtering) for the list, combined with `and` and `or`.
	*/
	filters?: EventFilters | {
		or: EventFilters[];
	} | {
		and: (EventFilters | {
			or: EventFilters[];
		})[];
	};
};
export type PaymentCreateParams = {
	expand?: PaymentExpand;
} & {
	/**
	* The amount to charge, in cents. With `invoice`, it's the invoice's remaining balance and can be omitted.
	* @min 0
	*/
	amount?: number;
	/**
	* The checkout session's `updated_at`. The payment is rejected with `checkout_totals_changed` if the session changed since.
	*/
	checkout_session_updated_at?: number;
	/**
	* When to capture the payment.
	* @default automatic
	*/
	capture_method?: "automatic" | "manual";
	/**
	* The payment's customer.
	*/
	customer?: string | null;
	/**
	* What the payment is for.
	*/
	description?: string | null;
	/**
	* The invoice the payment pays.
	*/
	invoice?: string | null;
	/**
	* Your own [key-value data](/api/metadata) on the object.
	*/
	metadata?: MetadataInput | null;
	/**
	* The customer's authorization for future debits, recorded as a [mandate](/api/mandates). Required when saving a bank account with `setup_future_usage`, and accepted only then.
	*/
	mandate_data?: {
		/**
		* Proof that the customer authorized the debits.
		*/
		customer_acceptance: {
			/**
			* The customer accepted on a website or app.
			*/
			type: "online";
			/**
			* When the customer authorized the debits. Defaults to now.
			* @min -8640000000000000
			* @max 8640000000000000
			*/
			accepted_at?: number;
			/**
			* The customer's IP address when they authorized the debits. Required.
			*/
			ip_address?: string;
			/**
			* The customer's browser user agent when they authorized the debits. Required.
			*/
			user_agent?: string;
		} | {
			/**
			* You collected the authorization another way, such as in writing.
			*/
			type: "offline";
			/**
			* When the customer authorized the debits. Defaults to now.
			* @min -8640000000000000
			* @max 8640000000000000
			*/
			accepted_at?: number;
		};
		/**
		* The authorization the customer agreed to. Defaults to Bias's standard ACH authorization.
		*/
		authorization_text?: string;
	};
	/**
	* Whether the customer is absent, such as for a renewal or a delayed charge. Requires a saved payment method, and `true` requires one saved with `setup_future_usage: off_session`. Defaults to `true` for a saved payment method, unless it was saved with `on_session`.
	*/
	off_session?: boolean;
	/**
	* Whether the payment is one in a series charged on a fixed schedule, such as your own subscription renewals. Charges made as needed aren't recurring. Requires `off_session: true`.
	* @default false
	*/
	recurring?: boolean;
	/**
	* Whether to remember the customer's checkout details after a successful payment.
	* @default false
	*/
	remember?: boolean;
	/**
	* The payment method to charge: a saved payment method's ID, or new payment method details.
	*/
	payment_method: string | PaymentMethodCreate;
	/**
	* Overrides your default statement descriptor. It should start with your business name or domain, in printable ASCII without `<`, `>`, `\`, `'`, `"` or `*`.
	*/
	statement_descriptor?: string | null;
};
import type { InstanceConfig, RequestConfig, Exact } from "./types";
import type { Expanded } from "./expands";
export declare const resources: (config: InstanceConfig) => {
	checkout: {
		address: {
			autocomplete: (params: CheckoutAddressAutocompleteParams, requestConfig?: RequestConfig) => Promise<AddressAutocompleteSuggestion[] | InvalidRequestError | RateLimitError | ServerError>;
			validate: (params: CheckoutAddressValidateParams, requestConfig?: RequestConfig) => Promise<AddressValidationResult | InvalidRequestError | RateLimitError | ServerError>;
		};
		wallets: {
			applePay: {
				merchantSession: (params: CheckoutWalletApplePayMerchantSessionParams, requestConfig?: RequestConfig) => Promise<{
					[key: string]: any;
				} | InvalidRequestError | InvalidRequestError | InvalidRequestError | InvalidRequestError | RateLimitError | ServerError>;
				update: (params: CheckoutWalletApplePayUpdateParams, requestConfig?: RequestConfig) => Promise<CheckoutSession | InvalidRequestError | InvalidRequestError | InvalidRequestError | ServerError>;
			};
			configuration: (params?: CheckoutWalletConfigurationParams, requestConfig?: RequestConfig) => Promise<CheckoutWalletConfiguration | InvalidRequestError | ServerError>;
		};
	};
	checkoutSessions: {
		get: <P extends CheckoutSessionGetParams>(id: string, params?: Exact<P, CheckoutSessionGetParams>, requestConfig?: RequestConfig) => Promise<undefined extends P["expand"] ? CheckoutSession | InvalidRequestError | InvalidRequestError | RateLimitError | ServerError : Expanded<CheckoutSession, P["expand"]> | InvalidRequestError | InvalidRequestError | RateLimitError | ServerError>;
		update: (id: string, params?: CheckoutSessionUpdateParams, requestConfig?: RequestConfig) => Promise<CheckoutSession | InvalidRequestError | InvalidRequestError | (IdempotencyError | InvalidRequestError) | RateLimitError | ServerError>;
		discountCode: {
			apply: (id: string, params: CheckoutSessionDiscountCodeApplyParams, requestConfig?: RequestConfig) => Promise<CheckoutSession | InvalidRequestError | InvalidRequestError | InvalidRequestError | RateLimitError | ServerError>;
			remove: (id: string, discount: string, params?: CheckoutSessionDiscountCodeRemoveParams, requestConfig?: RequestConfig) => Promise<CheckoutSession | InvalidRequestError | InvalidRequestError | InvalidRequestError | RateLimitError | ServerError>;
		};
	};
	events: {
		list: <P extends EventListParams>(params?: Exact<P, EventListParams>, requestConfig?: RequestConfig) => Promise<P extends {
			stream: true;
		} ? AsyncGenerator<Expanded<Event, P["expand"]>> | InvalidRequestError | RateLimitError | ServerError : {
			/**
			* The object's type.
			*/
			object: "list";
			/**
			* Whether there are more objects beyond this page.
			*/
			has_more: boolean;
			/**
			* The objects on this page.
			*/
			items: Expanded<Event, P["expand"]>[];
		} | InvalidRequestError | RateLimitError | ServerError>;
	};
	payments: {
		create: (params: PaymentCreateParams, requestConfig?: RequestConfig) => Promise<Payment | (InvalidRequestError | PaymentError) | InvalidRequestError | (InvalidRequestError | IdempotencyError) | RateLimitError | ServerError>;
	};
};
