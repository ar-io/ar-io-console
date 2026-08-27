/**
 * The x402-protocol upload flow (formerly `useX402Upload` / `uploadFileWithX402`,
 * using the SDK's `X402Funding` mode) was never wired into the app and has been
 * removed as dead code. In x402-only mode, billable base-usdc uploads actually go
 * through the JIT `topUpWithTokens` path in `useFileUpload` / `useFolderUpload`,
 * not this hook.
 *
 * Only `clearX402SignerCache` remains: the wallet-switch cleanup paths (Header,
 * useWalletAccountListener, usePrivyWallet) still call it alongside the other
 * signer-cache clears. There is no x402 signer cache to clear anymore, so it is a
 * no-op — kept as a stable seam so those call sites are untouched and so a future
 * x402 upload implementation has an obvious place to hook back in.
 */
export function clearX402SignerCache(): void {
  // no-op: the x402 signer cache was removed with the unused useX402Upload hook.
}
