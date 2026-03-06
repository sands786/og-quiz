# OG Quiz — OpenGradient Knowledge Challenge

A fully on-chain trivia game built on the **OpenGradient Testnet**. Players connect MetaMask, pay **0.1 ETH** (testnet) to unlock 25 questions, and earn a rank based on their score.

---

## 🚀 Live Demo

Open `index.html` in any browser — no build step, no dependencies.

---

## 📁 Files

```
og-quiz/
├── index.html   # Structure & UI
├── style.css    # All styles (neon cyberpunk theme)
└── quiz.js      # Wallet logic + questions + game engine
```

---

## ⛓️ Network Details

| Field    | Value                                  |
|----------|----------------------------------------|
| Network  | OpenGradient Testnet                   |
| Chain ID | `10744` (hex: `0x29F8`)                |
| RPC URL  | `https://eth-devnet.opengradient.ai`   |
| Symbol   | `ETH`                                  |
| Explorer | https://explorer.opengradient.ai       |

---

## 💸 Payment Flow

1. User clicks **Connect MetaMask** → `eth_requestAccounts`
2. App calls `wallet_addEthereumChain` / `wallet_switchEthereumChain` to switch to OG Testnet
3. User clicks **Pay 0.1 ETH** → `eth_sendTransaction` to treasury address
4. App polls `eth_getTransactionReceipt` until confirmed
5. Quiz unlocks — tx hash shown on results screen with explorer link

> **To receive fees:** update `TREASURY` in `quiz.js` to your own wallet address.

---

## 🏆 Rank System

| Score  | Rank           |
|--------|----------------|
| 23–25  | 🏆 OG Legend   |
| 20–22  | 💎 Master Node |
| 17–19  | 🔮 TEE Validator|
| 13–16  | ⛓️ On-Chain Dev |
| 9–12   | 🌐 Inference Node|
| 5–8    | 📡 Testnet User |
| 0–4    | 🌱 Genesis Node |

---

## 🔧 Customization

- **Entry fee:** change `ENTRY_FEE_WEI` in `quiz.js`
- **Treasury wallet:** change `TREASURY` in `quiz.js`
- **Questions:** edit the `QUESTIONS` array in `quiz.js`
- **Timer:** change `timeLeft = 30` in `startTimer()`

---

## 💧 Get Testnet ETH

- Faucet: https://github.com/OpenGradient/testnet-faucet
- Setup guide: https://docs.opengradient.ai/developers/devnet.html

---

## 📚 Resources

- Docs: https://docs.opengradient.ai
- Explorer: https://explorer.opengradient.ai
- GitHub: https://github.com/OpenGradient
- Website: https://opengradient.ai

---

Built with 💜 on OpenGradient
