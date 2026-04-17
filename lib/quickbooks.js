/**
 * QuickBooks Online OAuth 2.0 + Accounting API helper
 *
 * Required env vars:
 *   QUICKBOOKS_CLIENT_ID
 *   QUICKBOOKS_CLIENT_SECRET
 *   QUICKBOOKS_SANDBOX=true   (omit or set false for production)
 *   NEXT_PUBLIC_APP_URL       (already used elsewhere)
 */

const QB_CLIENT_ID     = process.env.QUICKBOOKS_CLIENT_ID;
const QB_CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET;
const IS_SANDBOX       = process.env.QUICKBOOKS_SANDBOX !== "false"; // default sandbox

const AUTH_BASE = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const API_BASE  = IS_SANDBOX
  ? "https://sandbox-quickbooks.api.intuit.com"
  : "https://quickbooks.api.intuit.com";

const SCOPE         = "com.intuit.quickbooks.accounting";
const REDIRECT_URI  = `${process.env.NEXT_PUBLIC_APP_URL}/api/dashboard/quickbooks/callback`;

export function isConfigured() {
  return !!(QB_CLIENT_ID && QB_CLIENT_SECRET);
}

/** Returns the OAuth authorization URL to redirect the user to */
export function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id:     QB_CLIENT_ID,
    response_type: "code",
    scope:         SCOPE,
    redirect_uri:  REDIRECT_URI,
    state:         state || "",
  });
  return `${AUTH_BASE}?${params}`;
}

/** Exchange authorization code for tokens */
export async function exchangeCode(code, realmId) {
  const creds = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString("base64");
  const res   = await fetch(TOKEN_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/x-www-form-urlencoded",
      "Authorization": `Basic ${creds}`,
      "Accept":        "application/json",
    },
    body: new URLSearchParams({
      grant_type:   "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!res.ok) throw new Error(`QB token exchange failed: ${res.status}`);
  const data = await res.json();
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    Date.now() + data.expires_in * 1000,
    realmId,
  };
}

/** Refresh an expired access token */
export async function refreshAccessToken(refreshToken) {
  const creds = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString("base64");
  const res   = await fetch(TOKEN_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/x-www-form-urlencoded",
      "Authorization": `Basic ${creds}`,
      "Accept":        "application/json",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`QB token refresh failed: ${res.status}`);
  const data = await res.json();
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt:    Date.now() + data.expires_in * 1000,
  };
}

/** Get a valid access token, refreshing if needed. Saves updated tokens to Firestore. */
export async function getValidToken(tenantId, qbTokens) {
  if (!qbTokens?.accessToken) throw new Error("QuickBooks not connected");
  if (Date.now() < (qbTokens.expiresAt || 0) - 60_000) {
    return qbTokens.accessToken; // still valid
  }
  const refreshed = await refreshAccessToken(qbTokens.refreshToken);
  const { adminDb } = await import("@/lib/firebase-admin");
  await adminDb.collection("tenants").doc(tenantId).update({
    quickbooks: {
      ...qbTokens,
      ...refreshed,
    },
  });
  return refreshed.accessToken;
}

/** Find or create a QB Customer by email. Returns QB customer Id. */
export async function findOrCreateCustomer(accessToken, realmId, { name, email, phone }) {
  const query    = encodeURIComponent(`SELECT * FROM Customer WHERE PrimaryEmailAddr = '${email}' MAXRESULTS 1`);
  const queryRes = await fetch(`${API_BASE}/v3/company/${realmId}/query?query=${query}&minorversion=65`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const queryData = await queryRes.json();
  const existing  = queryData?.QueryResponse?.Customer?.[0];
  if (existing) return existing.Id;

  const createRes = await fetch(`${API_BASE}/v3/company/${realmId}/customer?minorversion=65`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      DisplayName:       name || email,
      PrimaryEmailAddr:  { Address: email },
      PrimaryPhone:      phone ? { FreeFormNumber: phone } : undefined,
    }),
  });
  const createData = await createRes.json();
  return createData?.Customer?.Id;
}

/**
 * Create a QB Invoice for a booking.
 * Returns the QB Invoice object.
 */
export async function createInvoice(accessToken, realmId, { booking, customerId }) {
  const address  = booking.fullAddress || booking.address || "Property";
  const dueDate  = new Date();
  dueDate.setDate(dueDate.getDate() + 30);
  const dueDateStr = dueDate.toISOString().slice(0, 10);

  const lineItems = [];
  if (booking.totalPrice > 0) {
    lineItems.push({
      Amount:    booking.totalPrice,
      DetailType: "SalesItemLineDetail",
      Description: `Photography services — ${address}`,
      SalesItemLineDetail: {
        UnitPrice: booking.totalPrice,
        Qty:       1,
      },
    });
  }

  if (!lineItems.length) {
    lineItems.push({
      Amount:    0,
      DetailType: "SalesItemLineDetail",
      Description: `Photography services — ${address}`,
      SalesItemLineDetail: { UnitPrice: 0, Qty: 1 },
    });
  }

  const body = {
    Line:         lineItems,
    CustomerRef:  { value: customerId },
    DueDate:      dueDateStr,
    PrivateNote:  `Booking ID: ${booking.id}`,
    DocNumber:    booking.id?.slice(0, 21), // QB max 21 chars
  };

  const res  = await fetch(`${API_BASE}/v3/company/${realmId}/invoice?minorversion=65`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data?.Fault || data));
  return data.Invoice;
}

/**
 * Record a payment against a QB Invoice.
 */
export async function recordPayment(accessToken, realmId, { invoiceId, amount, customerId }) {
  const body = {
    TotalAmt:    amount,
    CustomerRef: { value: customerId },
    Line: [{
      Amount:            amount,
      LinkedTxn: [{ TxnId: invoiceId, TxnType: "Invoice" }],
    }],
  };
  const res  = await fetch(`${API_BASE}/v3/company/${realmId}/payment?minorversion=65`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data?.Fault || data));
  return data.Payment;
}

/**
 * Full sync: create customer + invoice in QB for a booking.
 * Saves qbInvoiceId + qbCustomerId back onto the booking document.
 */
export async function syncBookingToQB(tenantId, booking, qbTokens) {
  const accessToken = await getValidToken(tenantId, qbTokens);
  const realmId     = qbTokens.realmId;

  // Skip if already synced
  if (booking.qbInvoiceId) return { skipped: true };

  const customerId = await findOrCreateCustomer(accessToken, realmId, {
    name:  booking.clientName,
    email: booking.clientEmail,
    phone: booking.clientPhone,
  });

  const invoice = await createInvoice(accessToken, realmId, { booking, customerId });

  const { adminDb } = await import("@/lib/firebase-admin");
  await adminDb
    .collection("tenants").doc(tenantId)
    .collection("bookings").doc(booking.id)
    .update({ qbInvoiceId: invoice.Id, qbCustomerId: customerId, qbSyncedAt: new Date() });

  return { invoiceId: invoice.Id, customerId };
}
