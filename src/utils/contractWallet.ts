/**
 * EIP-7702 delegation designator: `0xef0100` followed by a 20-byte address.
 * An EOA that has delegated its code (a MetaMask "smart account", for example)
 * reports this as its code, yet still sends ordinary transactions straight to
 * their target, so a memo in its calldata survives.
 */
const EIP7702_DELEGATION = /^0xef0100[0-9a-f]{40}$/i;

/**
 * True if the address's code (from `eth_getCode`) belongs to a smart-contract
 * wallet; false for an EOA, including one with an EIP-7702 delegation.
 *
 * A contract wallet sends through its own contract (an ERC-4337 bundle, a
 * multicall), so the transaction on-chain is not the direct transfer Turbo
 * parses, and a `turboCreditDestinationAddress` memo in it is never read: the
 * payment service credits the sender instead. A wallet not yet deployed
 * (a Coinbase Smart Wallet before its first transaction on that chain) has no
 * code and reads as false, which this cannot detect.
 */
export function isContractWalletCode(code: string | null | undefined): boolean {
  if (!code) return false;
  const hex = code.toLowerCase();
  if (hex === '0x' || hex === '0x0') return false;
  return !EIP7702_DELEGATION.test(hex);
}

export const CONTRACT_WALLET_DESTINATION_ERROR =
  'This wallet is a smart-contract wallet. Turbo cannot read which account to ' +
  'credit from its payments, so they would credit this wallet instead of the ' +
  'one you are buying for. Nothing was sent. Pay by card, or send from a ' +
  'standard wallet.';
