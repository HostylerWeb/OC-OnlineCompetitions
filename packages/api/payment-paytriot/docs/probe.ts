import { sign, httpParseQuery, verifyResponse } from "../src/signature";
import { Gateway } from "../src/gateway";
import type { GatewayRequest } from "../src/types";

/**
 * Paytriot signature probe.
 *
 * 1. Verify our REQUEST signing matches Paytriot's sigtest.php dev tool.
 * 2. Try multiple field subsets against a captured hosted-form RESPONSE
 *    to find which subset Paytriot signs on the way back.
 *
 * Run with: bun run scripts/sig-probe.ts
 */

const TEST_MERCHANT_ID = "105631";
const TEST_MERCHANT_SECRET = "Media49Stone36Carrot";
const PAYTRIOT_SIGTEST_URL = "https://gateway.paytriot.co.uk/devtools/sigtest.php";

function buildSampleRequest(): GatewayRequest {
  return {
    merchantID: TEST_MERCHANT_ID,
    action: "SALE",
    type: 1,
    transactionUnique: `probe-${Date.now()}`,
    countryCode: 826,
    currencyCode: 826,
    amount: 1500,
    redirectURL: "https://app.staging.onlinecompetitions.co.uk/api/payments/paytriot/return",
    threeDSRedirectURL: "https://app.staging.onlinecompetitions.co.uk/api/payments/paytriot/return",
    remoteAddress: "127.0.0.1",
    customerEmail: "probe@example.com",
    customerName: "Probe User",
    customerAddress: "16 Some Street",
    customerPostCode: "155",
    customerTown: "London",
    customerCountryCode: "826",
    customerPhone: "+442038841611",
    orderRef: "Probe Test",
    duplicateDelay: 600,
    captureDelay: 0,
    statementNarrative1: "Paytrio*Ukcomp",
    statementNarrative2: "02038841611",
    cardCVVMandatory: "N",
    customerAddressMandatory: "Y",
    customerPostcodeMandatory: "Y",
    customerEmailMandatory: "Y",
    customerPhoneMandatory: "Y",
    avscv2CheckRequired: "Y",
    cv2CheckPref: "not known,not checked,not matched,partially matched,matched",
    addressCheckPref: "not known,not checked,not matched,partially matched,matched",
    postcodeCheckPref: "not known,not checked,not matched,partially matched,matched",
    threeDSRequired: "Y",
    threeDSCheckPref: "not known,not checked,not authenticated,attempted authentication,authenticated",
    customerReceiptsRequired: "N",
    notifyEmailRequired: "N",
    merchantCategoryCode: "8999",
  };
}

async function probeRequestSigning(): Promise<void> {
  console.log("=".repeat(80));
  console.log("STAGE 1: Verify REQUEST signing against Paytriot sigtest.php");
  console.log("=".repeat(80));

  const request = buildSampleRequest();
  const gateway = new Gateway({
    merchantID: TEST_MERCHANT_ID,
    merchantSecret: TEST_MERCHANT_SECRET,
  });
  const ourHash = gateway.prepareRequest({ ...request }).signature ?? "";

  const dataClone: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(request)) {
    if (v !== undefined) dataClone[k] = v;
  }
  const ourHashDirect = sign(dataClone, TEST_MERCHANT_SECRET);

  console.log(`Our hash (via Gateway): ${ourHash}`);
  console.log(`Our hash (via sign()):  ${ourHashDirect}`);
  console.log(`Match: ${ourHash === ourHashDirect}`);

  const formData = new URLSearchParams();
  for (const [k, v] of Object.entries(request)) {
    if (v !== undefined) formData.append(k, String(v));
  }
  formData.append("signature", ourHash);

  console.log(`\nPOSTing ${formData.toString().length} bytes to ${PAYTRIOT_SIGTEST_URL}`);

  try {
    const response = await fetch(`${PAYTRIOT_SIGTEST_URL}?key=${encodeURIComponent(TEST_MERCHANT_SECRET)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const responseText = await response.text();
    console.log(`\nPaytriot sigtest.php status: ${response.status}`);
    console.log(`Response (full, length=${responseText.length}):`);
    console.log(responseText);

    const ourHashMatch = responseText.includes(ourHash);
    console.log(`\nOur hash appears in Paytriot response: ${ourHashMatch}`);

    const hashMatches = responseText.match(/[a-f0-9]{128}/g);
    if (hashMatches) {
      console.log(`\nHashes found in response (${hashMatches.length}):`);
      for (const h of hashMatches.slice(0, 5)) {
        console.log(`  ${h}`);
        console.log(`  match=${h === ourHash}`);
      }
    }
  } catch (err) {
    console.error("Probe request signing failed:", err);
  }
}

const HOSTED_FORM_RESPONSE_BODY = process.env.PAYTRIOT_RESPONSE_BODY ?? "";

const FIELD_PRESETS: Record<string, string[]> = {
  "all-non-auto": [
    "action",
    "amount",
    "amountReceived",
    "authorisationCode",
    "avscv2CheckEnabled",
    "avscv2ResponseCode",
    "avscv2ResponseMessage",
    "addressCheck",
    "cardCVVMandatory",
    "cardExpiryDate",
    "cardNumberMask",
    "cardScheme",
    "cardSchemeCode",
    "cardType",
    "cardTypeCode",
    "countryCode",
    "currencyCode",
    "customerAddressMandatory",
    "customerEmail",
    "customerEmailMandatory",
    "customerName",
    "customerPhone",
    "customerPhoneMandatory",
    "customerPostcodeMandatory",
    "cv2Check",
    "duplicateDelay",
    "merchantCategoryCode",
    "merchantID",
    "notifyEmailRequired",
    "orderRef",
    "postcodeCheck",
    "redirectURL",
    "remoteAddress",
    "responseCode",
    "responseMessage",
    "statementNarrative1",
    "statementNarrative2",
    "threeDSAuthenticated",
    "threeDSCheckPref",
    "threeDSEnabled",
    "threeDSEnrolled",
    "threeDSRequired",
    "timestamp",
    "transactionID",
    "transactionUnique",
    "type",
    "xref",
  ],
  "request-only": [
    "action",
    "amount",
    "avscv2CheckRequired",
    "captureDelay",
    "cardCVVMandatory",
    "countryCode",
    "currencyCode",
    "customerAddress",
    "customerAddressMandatory",
    "customerCountryCode",
    "customerEmail",
    "customerEmailMandatory",
    "customerName",
    "customerPhone",
    "customerPhoneMandatory",
    "customerPostCode",
    "customerPostcodeMandatory",
    "customerTown",
    "duplicateDelay",
    "merchantCategoryCode",
    "merchantID",
    "notifyEmailRequired",
    "orderRef",
    "redirectURL",
    "remoteAddress",
    "statementNarrative1",
    "statementNarrative2",
    "threeDSCheckPref",
    "threeDSRedirectURL",
    "threeDSRequired",
    "transactionUnique",
    "type",
  ],
  "docs-section-2.1": [
    "merchantID",
    "action",
    "amount",
    "countryCode",
    "currencyCode",
    "transactionUnique",
    "orderRef",
    "redirectURL",
    "type",
  ],
  "all-keys-sorted": [],
  "minimal-signature-only": ["merchantID", "responseCode", "transactionUnique"],
  "merchantID-action-amount": ["merchantID", "action", "amount"],
};

function trySubset(
  responseFields: Record<string, unknown>,
  receivedSig: string,
  subset: string[]
): { matched: boolean; computed: string; missing?: string[] } {
  const missing: string[] = [];
  const data: Record<string, unknown> = {};
  for (const k of subset) {
    if (responseFields[k] !== undefined) {
      data[k] = responseFields[k];
    } else {
      missing.push(k);
    }
  }
  const dataClone = { ...data };
  const computed = sign(dataClone, TEST_MERCHANT_SECRET);
  return {
    matched: computed === receivedSig,
    computed,
    missing: missing.length ? missing : undefined,
  };
}

async function probeResponseSigning(): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log("STAGE 2: Try subsets against a captured hosted-form RESPONSE body");
  console.log("=".repeat(80));

  if (!HOSTED_FORM_RESPONSE_BODY) {
    console.log(
      "\nNo PAYTRIOT_RESPONSE_BODY env var set. To test response subsets, run a real"
    );
    console.log("Paytriot transaction, capture the body from staging logs, then:");
    console.log(
      '  PAYTRIOT_RESPONSE_BODY="responseCode=0&..." bun run scripts/sig-probe.ts'
    );
    return;
  }

  const parsed = httpParseQuery(HOSTED_FORM_RESPONSE_BODY);
  const receivedSig = (parsed.signature as string) ?? "";
  if (!receivedSig) {
    console.log("Captured body has no signature field. Aborting.");
    return;
  }

  console.log(`Body has ${Object.keys(parsed).length} fields`);
  console.log(`Received signature: ${receivedSig}`);
  console.log(`Received signature prefix: ${receivedSig.slice(0, 20)}`);
  console.log(`Received signature contains '|': ${receivedSig.includes("|")}`);

  if (receivedSig.includes("|")) {
    const pipeIdx = receivedSig.indexOf("|");
    const partialHash = receivedSig.slice(0, pipeIdx);
    const partialFields = receivedSig.slice(pipeIdx + 1);
    console.log(`Detected partial signing! Hash: ${partialHash}`);
    console.log(`Field list (pipe-separated): ${partialFields}`);

    const partialFieldList = partialFields.split(",").map((f) => f.trim());
    const result = trySubset(parsed, partialHash, partialFieldList);
    console.log(`Partial signature verifies: ${result.matched}`);
  }

  for (const [name, subset] of Object.entries(FIELD_PRESETS)) {
    if (subset.length === 0) continue;
    const result = trySubset(parsed, receivedSig, subset);
    const status = result.matched ? "✅ MATCH" : "❌ no match";
    const missingInfo = result.missing ? ` missing=${result.missing.join(",")}` : "";
    const computedPrefix = result.computed.slice(0, 20);
    console.log(
      `[${status}] preset="${name}" fields=${subset.length} computedPrefix=${computedPrefix}${missingInfo}`
    );
  }

  const allKeys = Object.keys(parsed).filter((k) => k !== "signature");
  const allResult = trySubset(parsed, receivedSig, allKeys);
  console.log(
    `[${allResult.matched ? "✅ MATCH" : "❌ no match"}] preset="ALL-FIELDS-NO-SIGNATURE" fields=${allKeys.length} computedPrefix=${allResult.computed.slice(0, 20)}`
  );

  const allKeysIncludingEmptyString = Object.keys(parsed).filter((k) => k !== "signature");
  const allResult2 = sign(allKeysIncludingEmptyString.reduce<Record<string, unknown>>((acc, k) => {
    acc[k] = parsed[k];
    return acc;
  }, {}), TEST_MERCHANT_SECRET);
  const allMatch2 = allResult2 === receivedSig;
  console.log(
    `[${allMatch2 ? "✅ MATCH" : "❌ no match"}] preset="FULL-SIGN-ALL-FIELDS-AS-IS" fields=${allKeysIncludingEmptyString.length} computedPrefix=${allResult2.slice(0, 20)}`
  );

  console.log("\nTrying subsets by exclusion of likely 'auto-added config echoes':");
  const AUTO_ADDED = new Set([
    "__wafRequestID",
    "acquirerResponseCode",
    "acquirerResponseMessage",
    "acquirerTransactionID",
    "deviceAcceptContent",
    "deviceAcceptEncoding",
    "deviceAcceptLanguage",
    "deviceCapabilities",
    "deviceChannel",
    "deviceIdentity",
    "deviceIpAddress",
    "deviceScreenResolution",
    "deviceTimeZone",
    "displayAmount",
    "displayCurrency",
    "eReceiptsEnabled",
    "formAmountEditable",
    "formResponsive",
    "initiator",
    "paymentMethod",
    "processorStatus",
    "requestID",
    "requestMerchantID",
    "processMerchantID",
    "responseStatus",
    "riskCheckEnabled",
    "surchargeEnabled",
    "threeDSPolicy",
    "threeDSVersion",
    "threeDSURL",
    "threeDSResponseCode",
    "threeDSResponseMessage",
    "threeDSOptions[challengeWindowSize]",
    "threeDSDetails[acquirerCountryCode]",
    "threeDSDetails[acsTransID]",
    "threeDSDetails[authenticationType]",
    "threeDSDetails[cardholderInformation]",
    "threeDSDetails[challengeIndicator]",
    "threeDSDetails[challengeMandatedIndicator]",
    "threeDSDetails[dsTransID]",
    "threeDSDetails[eci]",
    "threeDSDetails[fallback]",
    "threeDSDetails[interactionCounter]",
    "threeDSDetails[issuerCountryCode]",
    "threeDSDetails[psd2Region]",
    "threeDSDetails[requestorChallengeIndicator]",
    "threeDSDetails[transID]",
    "threeDSDetails[transactionStatusReason]",
    "threeDSDetails[transactionStatus]",
    "threeDSDetails[version]",
    "threeDSDetails[versions]",
    "threeDSDetails[whitelistStatusSource]",
    "threeDSDetails[whitelistStatus]",
    "threeDSRequest[creq]",
    "threeDSResponse[cres]",
    "vcsResponseCode",
    "vcsResponseMessage",
    "currencyExponent",
    "currencySymbol",
    "rtAdviceCode",
    "amountApproved",
    "amountRetained",
    "avscv2AuthEntity",
    "customerContactMandatory",
    "customerNameMandatory",
    "customerPostcode",
    "cardExpiryDate",
    "cardExpiryDateMandatory",
    "cardExpiryMonth",
    "cardExpiryYear",
    "cardFlags",
    "cardNumberValid",
  ]);
  const nonAutoAdded = allKeys.filter((k) => !AUTO_ADDED.has(k));
  const noAutoResult = trySubset(parsed, receivedSig, nonAutoAdded);
  console.log(
    `[${noAutoResult.matched ? "✅ MATCH" : "❌ no match"}] preset="ALL-MINUS-AUTO-ADDED" fields=${nonAutoAdded.length} computedPrefix=${noAutoResult.computed.slice(0, 20)}`
  );

  console.log("\nTrying with bracket-notation normalised to dotted:");
  const bracketNormalised: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed)) {
    const normalisedKey = k.replace(/\[([^\]]+)\]/g, ".$1");
    if (!bracketNormalised[normalisedKey]) {
      bracketNormalised[normalisedKey] = v;
    }
  }
  const bracketKeys = Object.keys(bracketNormalised).filter((k) => k !== "signature");
  const bracketData: Record<string, unknown> = {};
  for (const k of bracketKeys) bracketData[k] = bracketNormalised[k];
  const bracketHash = sign(bracketData, TEST_MERCHANT_SECRET);
  console.log(
    `[${bracketHash === receivedSig ? "✅ MATCH" : "❌ no match"}] preset="BRACKET-NORMALISED" fields=${bracketKeys.length} computedPrefix=${bracketHash.slice(0, 20)}`
  );

  console.log("\nAll field names in captured response (sorted):");
  console.log(Object.keys(parsed).sort().join(", "));
}

async function main() {
  await probeRequestSigning();
  await probeResponseSigning();
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
