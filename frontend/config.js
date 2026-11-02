// ============================================================
// EDIT ONLY CONTRACT_ADDRESS after deploying.
// (If you use Hoodi instead of Sepolia, also change the network
//  fields below: chain id, RPC URL, explorer URL. Look up the
//  current values on the official Hoodi docs.)
// ============================================================
window.APP_CONFIG = {
  CONTRACT_ADDRESS: "0x26A9Ef936862f396eF0372bD0dC7c0baEC209d7D",

  NETWORK_NAME: "Sepolia",
  CHAIN_ID: 11155111,
  CHAIN_ID_HEX: "0xaa36a7",
  // Public RPC used for READING messages without a wallet.
  // You can swap this for your Alchemy/Infura URL (it is visible in the browser, so use a testnet key only).
  PUBLIC_RPC_URL: "https://ethereum-sepolia-rpc.publicnode.com",
  EXPLORER_URL: "https://sepolia.etherscan.io",

  MAX_MESSAGE_LENGTH: 280, // bytes, must match the contract
  RECENT_LIMIT: 20,        // how many recent messages to show

  // Human-readable ABI (ethers v6 understands this directly).
  ABI: [
    "function postMessage(string text)",
    "function messageCount() view returns (uint256)",
    "function getMessage(uint256 id) view returns (tuple(address author, string text, uint256 timestamp))",
    "function getRecentMessages(uint256 limit) view returns (tuple(address author, string text, uint256 timestamp)[])",
    "function MAX_MESSAGE_LENGTH() view returns (uint256)",
    "event MessagePosted(address indexed author, uint256 indexed id, string text, uint256 timestamp)"
  ],
};
