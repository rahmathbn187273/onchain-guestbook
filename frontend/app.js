(() => {
  "use strict";

  const cfg = window.APP_CONFIG;
  const { ethers } = window;
  const $ = (id) => document.getElementById(id);

  const el = {
    banner: $("banner"), connectBtn: $("connect-btn"), switchBtn: $("switch-btn"),
    account: $("account"), network: $("network"), count: $("count"),
    form: $("post-form"), input: $("message-input"), charCount: $("char-count"),
    postBtn: $("post-btn"), status: $("status"), list: $("messages"),
    refreshBtn: $("refresh-btn"), contractLink: $("contract-link"),
  };

  const contractReady = ethers.isAddress(cfg.CONTRACT_ADDRESS);
  // Read-only provider: lets everyone see messages without a wallet.
  const readProvider = new ethers.JsonRpcProvider(cfg.PUBLIC_RPC_URL);

  // ---------- helpers ----------
  const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const byteLen = (s) => new TextEncoder().encode(s).length;

  function setStatus(message, type = "info", txHash = null) {
    el.status.className = `status ${type}`;
    el.status.textContent = message;
    if (txHash) {
      el.status.append(" ");
      const a = document.createElement("a");
      a.href = `${cfg.EXPLORER_URL}/tx/${txHash}`;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "View on Etherscan";
      el.status.append(a);
      const h = document.createElement("div");
      h.className = "hash";
      h.textContent = `Tx hash: ${txHash}`;
      el.status.append(h);
    }
  }

  function friendlyError(err) {
    const code = err && err.code;
    if (code === "ACTION_REJECTED" || code === 4001)
      return "You rejected the request in MetaMask.";
    if (code === -32002)
      return "A MetaMask request is already open. Check the MetaMask popup.";
    if (code === "INSUFFICIENT_FUNDS")
      return "Insufficient funds: you need Sepolia ETH to pay gas. Use a faucet.";
    if (code === "NONCE_EXPIRED" || code === "REPLACEMENT_UNDERPRICED")
      return "Nonce problem. In MetaMask: Settings > Advanced > Clear activity tab data, then retry.";
    if (code === "CALL_EXCEPTION" && err.reason)
      return `The contract rejected the transaction: ${err.reason}`;
    return (err && (err.shortMessage || err.message)) || "Unknown error";
  }

  // ---------- wallet / network ----------
  async function refreshWalletUI() {
    if (!window.ethereum) {
      el.account.textContent = "MetaMask not detected";
      el.network.textContent = "-";
      el.connectBtn.disabled = false;
      el.postBtn.disabled = true;
      return { account: null, ok: false };
    }
    const [accounts, chainId] = await Promise.all([
      window.ethereum.request({ method: "eth_accounts" }),
      window.ethereum.request({ method: "eth_chainId" }),
    ]);
    const account = accounts[0] || null;
    const ok = chainId.toLowerCase() === cfg.CHAIN_ID_HEX;

    el.account.textContent = account || "Not connected";
    el.network.textContent = ok
      ? `${cfg.NETWORK_NAME} ✓`
      : `Wrong network (chain ID ${parseInt(chainId, 16)})`;
    el.network.className = ok ? "ok" : "bad";
    el.switchBtn.classList.toggle("hidden", ok);
    el.connectBtn.textContent = account ? "Wallet connected" : "Connect MetaMask";
    el.connectBtn.disabled = !!account;
    el.postBtn.disabled = !account || !contractReady;
    return { account, ok };
  }

  async function switchNetwork() {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: cfg.CHAIN_ID_HEX }],
      });
    } catch (err) {
      if (err.code === 4902) {
        // Network not added to MetaMask yet: add it.
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: cfg.CHAIN_ID_HEX,
            chainName: cfg.NETWORK_NAME,
            nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: [cfg.PUBLIC_RPC_URL],
            blockExplorerUrls: [cfg.EXPLORER_URL],
          }],
        });
      } else {
        throw err;
      }
    }
  }

  async function connect() {
    if (!window.ethereum) {
      setStatus("MetaMask not detected. Install it from metamask.io, then reload this page.", "error");
      return;
    }
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const { ok } = await refreshWalletUI();
      setStatus(
        ok ? "Wallet connected." : `Wrong network. Click "Switch to ${cfg.NETWORK_NAME}".`,
        ok ? "success" : "error"
      );
    } catch (err) {
      setStatus(friendlyError(err), "error");
    }
  }

  async function onSwitchClick() {
    try {
      await switchNetwork();
      await refreshWalletUI();
      setStatus(`Switched to ${cfg.NETWORK_NAME}.`, "success");
    } catch (err) {
      setStatus(friendlyError(err), "error");
    }
  }

  // ---------- reading from the contract ----------
  function renderMessages(msgs) {
    el.list.replaceChildren();
    if (msgs.length === 0) {
      const li = document.createElement("li");
      li.className = "muted";
      li.textContent = "No messages yet. Be the first!";
      el.list.append(li);
      return;
    }
    for (const m of msgs) {
      const li = document.createElement("li");
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `${shortAddr(m.author)} · ${new Date(Number(m.timestamp) * 1000).toLocaleString()}`;
      const body = document.createElement("p");
      body.textContent = m.text; // textContent (not innerHTML) so messages can't inject HTML
      li.append(meta, body);
      el.list.append(li);
    }
  }

  async function loadMessages() {
    if (!contractReady) return;
    el.refreshBtn.disabled = true;
    try {
      const c = new ethers.Contract(cfg.CONTRACT_ADDRESS, cfg.ABI, readProvider);
      const [count, recent] = await Promise.all([
        c.messageCount(),
        c.getRecentMessages(cfg.RECENT_LIMIT),
      ]);
      el.count.textContent = count.toString();
      renderMessages(recent);
    } catch (err) {
      console.error(err);
      setStatus("Could not load messages. Check CONTRACT_ADDRESS in config.js and that it is deployed on Sepolia.", "error");
    } finally {
      el.refreshBtn.disabled = false;
    }
  }

  // ---------- writing to the contract ----------
  async function postMessage(text) {
    el.postBtn.disabled = true;
    try {
      if (!window.ethereum) throw new Error("MetaMask not detected.");
      await window.ethereum.request({ method: "eth_requestAccounts" });

      // Make sure we are on Sepolia (prompts MetaMask to switch if not).
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (chainId.toLowerCase() !== cfg.CHAIN_ID_HEX) {
        setStatus(`Please approve switching to ${cfg.NETWORK_NAME} in MetaMask…`, "pending");
        await switchNetwork();
      }

      // Fresh provider AFTER any network switch (ethers v6 requires this).
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const writeContract = new ethers.Contract(cfg.CONTRACT_ADDRESS, cfg.ABI, signer);

      setStatus("Waiting for you to confirm in MetaMask…", "pending");
      const tx = await writeContract.postMessage(text);

      setStatus("Transaction sent. Waiting for confirmation…", "pending", tx.hash);
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        setStatus(`Confirmed in block ${receipt.blockNumber}.`, "success", tx.hash);
        el.input.value = "";
        updateCounter();
        setTimeout(loadMessages, 2000); // small delay so the public RPC catches up
      } else {
        setStatus("Transaction failed on-chain.", "error", tx.hash);
      }
    } catch (err) {
      console.error(err);
      setStatus(friendlyError(err), "error");
    } finally {
      await refreshWalletUI();
    }
  }

  // ---------- UI wiring ----------
  function updateCounter() {
    const n = byteLen(el.input.value);
    el.charCount.textContent = `${n} / ${cfg.MAX_MESSAGE_LENGTH} bytes`;
    el.charCount.className = n > cfg.MAX_MESSAGE_LENGTH ? "bad" : "muted";
  }

  el.input.addEventListener("input", updateCounter);
  el.connectBtn.addEventListener("click", connect);
  el.switchBtn.addEventListener("click", onSwitchClick);
  el.refreshBtn.addEventListener("click", loadMessages);

  el.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = el.input.value.trim();
    if (!text) return setStatus("Please type a message first.", "error");
    if (byteLen(text) > cfg.MAX_MESSAGE_LENGTH)
      return setStatus(`Message too long (max ${cfg.MAX_MESSAGE_LENGTH} bytes).`, "error");
    postMessage(text);
  });

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", refreshWalletUI);
    window.ethereum.on("chainChanged", refreshWalletUI);
  }

  async function init() {
    if (!contractReady) {
      el.banner.textContent = "Contract address not set. Deploy the contract, then paste its address into frontend/config.js.";
      el.banner.classList.remove("hidden");
    } else {
      el.contractLink.href = `${cfg.EXPLORER_URL}/address/${cfg.CONTRACT_ADDRESS}`;
      el.contractLink.textContent = shortAddr(cfg.CONTRACT_ADDRESS);
    }
    if (!window.ethereum) {
      setStatus("MetaMask not detected. You can read messages, but you need MetaMask to post.", "error");
    }
    await refreshWalletUI();
    await loadMessages();
    setInterval(loadMessages, 15000); // auto-refresh every 15s
  }

  init();
})();
