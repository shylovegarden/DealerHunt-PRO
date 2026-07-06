// The VAPID PUBLIC key — safe to ship to the browser (it's the server's public identity for Web Push).
// Overridable via env, but this default lets subscriptions work out of the box. The matching PRIVATE key is
// a secret env var (VAPID_PRIVATE_KEY) set in the deployment — never committed.
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BEvkjOTxn6Lubd_AXlZ2n2N4mD9KtzEO4HXILM1mzV2-bPJ1QcbedwcTqWcB7TqXlwDdphdsrMm7fvI2zM2UB30";
