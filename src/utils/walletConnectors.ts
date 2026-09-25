/**
 * RainbowKit wallets the connect modal offers, by id. An allowlist rather than
 * a denylist: RainbowKit is on a caret range, and a minor release that adds a
 * smart-contract wallet to its defaults must not reach the modal silently.
 * Installed browser wallets appear regardless, through EIP-6963 discovery.
 */
export const OFFERED_WALLET_IDS = new Set(['rainbow', 'metaMask', 'walletConnect']);

/**
 * Connectors for smart-contract wallets, which cannot give the plain signature
 * Turbo's Ethereum signer needs. Removed from the modal; a session restored
 * from one is signed out.
 */
export const SMART_CONTRACT_CONNECTOR_IDS = new Set(['baseAccount', 'safe']);
