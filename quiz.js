/* ═══════════════════════════════════════════════════════════
   OG QUIZ — quiz.js
   OpenGradient Testnet: Chain ID 10744 (0x29f8)
   RPC: https://eth-devnet.opengradient.ai
   Created by: Master Shifu | @husnain50376345 | alpha_53645
════════════════════════════════════════════════════════════ */

// ── NETWORK CONFIG ──────────────────────────────────────────
const OG_NETWORK = {
  chainId: '0x29f8',                          // 10744 — lowercase to match MetaMask
  chainName: 'OpenGradient Testnet',
  rpcUrls: ['https://eth-devnet.opengradient.ai'],
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  blockExplorerUrls: ['https://explorer.opengradient.ai'],
};

const ENTRY_FEE_WEI = '0x16345785D8A0000'; // 0.1 ETH in wei
// ⚠️ Replace with YOUR wallet to receive entry fees
const TREASURY = '0x0000000000000000000000000000000000000001';

// ── STATE ───────────────────────────────────────────────────
let walletAddress = '';
let txHash = '';
let currentQ = 0, score = 0, answers = [];
let timerInterval = null, timeLeft = 30;

// ── WALLET CONNECT ──────────────────────────────────────────
async function connectWallet() {
  const btn    = document.getElementById('connect-btn');
  const status = document.getElementById('wallet-status');

  if (typeof window.ethereum === 'undefined' || !window.ethereum.isMetaMask) {
    showStatus(status, '❌ MetaMask not found. <a href="https://metamask.io/download/" target="_blank" style="color:#00D4FF">Install here →</a>', true);
    return;
  }

  // Check if already connected — no popup needed
  try {
    const existing = await window.ethereum.request({ method: 'eth_accounts' });
    if (existing && existing.length > 0) {
      walletAddress = existing[0];
      onWalletConnected(btn, status);
      return;
    }
  } catch (_) {}

  // Request connection
  btn.disabled = true;
  btn.textContent = '⏳ Check MetaMask popup...';
  showStatus(status, '👆 Approve the MetaMask popup to continue', false);

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    walletAddress = accounts[0];
    onWalletConnected(btn, status);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Connect MetaMask';
    if (err.code === 4001)
      showStatus(status, '❌ Connection rejected. Try again.', true);
    else if (err.code === -32002)
      showStatus(status, '⚠️ MetaMask already has a pending request — click the MetaMask icon in your browser toolbar and approve it.', true);
    else
      showStatus(status, '❌ ' + (err.message || 'Unknown error'), true);
  }
}

function onWalletConnected(btn, status) {
  const short = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
  showStatus(status, '✓ Connected: ' + short, false);
  btn.textContent = '✓ ' + short;
  btn.style.background = 'linear-gradient(135deg,#00FF9D,#00D4FF)';
  btn.style.color = '#050508';
  btn.disabled = false;
  document.getElementById('step-network').classList.remove('hidden');
  showToast('✓ Wallet connected! Switch to OG Testnet next.');
  window.ethereum.on('accountsChanged', (accs) => {
    if (!accs.length) location.reload();
    else walletAddress = accs[0];
  });
}

// ── SWITCH NETWORK ──────────────────────────────────────────
async function switchNetwork() {
  const btn = document.getElementById('network-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Switching...';

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: OG_NETWORK.chainId }],
    });
    onNetworkSwitched();
  } catch (err) {
    if (err.code === 4902 || err.code === -32603) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [OG_NETWORK],
        });
        onNetworkSwitched();
      } catch (addErr) {
        btn.disabled = false;
        btn.textContent = '🔗 Switch to OpenGradient Testnet';
        showToast('❌ Failed to add network: ' + addErr.message, true);
      }
    } else if (err.code === 4001) {
      btn.disabled = false;
      btn.textContent = '🔗 Switch to OpenGradient Testnet';
      showToast('❌ Network switch rejected', true);
    } else {
      btn.disabled = false;
      btn.textContent = '🔗 Switch to OpenGradient Testnet';
      showToast('❌ ' + (err.message || 'Unknown error'), true);
    }
  }
}

function onNetworkSwitched() {
  const btn = document.getElementById('network-btn');
  btn.textContent = '✓ On OpenGradient Testnet';
  btn.style.background = 'linear-gradient(135deg,#00FF9D,#00D4FF)';
  btn.style.color = '#050508';
  btn.disabled = true;
  document.getElementById('step-pay').classList.remove('hidden');
  showToast('✓ Switched to OpenGradient Testnet!');
}

// ── PAY & START ─────────────────────────────────────────────
async function payAndStart() {
  const btn = document.getElementById('pay-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Confirm in MetaMask...';

  try {
    // Case-insensitive chain ID check — MetaMask returns lowercase
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (chainId.toLowerCase() !== OG_NETWORK.chainId.toLowerCase()) {
      showToast('❌ Please switch to OpenGradient Testnet first', true);
      btn.disabled = false;
      btn.textContent = '💸 Pay 0.1 ETH & Start Quiz →';
      return;
    }

    // Clean native ETH transfer — no data field, no contract call
    const hash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from:  walletAddress,
        to:    TREASURY,
        value: ENTRY_FEE_WEI,
        gas:   '0x5208',   // 21000 — standard ETH transfer, cheapest possible
      }],
    });

    txHash = hash;
    btn.textContent = '⏳ Confirming on-chain...';
    showToast('✅ Transaction sent! Confirming...');
    await waitForReceipt(hash);

    btn.textContent = '✓ Paid! Loading quiz...';
    btn.style.background = 'linear-gradient(135deg,#00FF9D,#00D4FF)';
    btn.style.color = '#050508';
    showToast('🎉 Entry fee paid! Quiz unlocked!');
    setTimeout(() => startQuiz(), 1200);

  } catch (err) {
    btn.disabled = false;
    btn.textContent = '💸 Pay 0.1 ETH & Start Quiz →';
    if (err.code === 4001)
      showToast('❌ Transaction rejected', true);
    else if (err.code === -32603)
      showToast('❌ Insufficient funds — get testnet ETH from faucet.opengradient.ai', true);
    else
      showToast('❌ ' + (err.message || 'Unknown error'), true);
  }
}

async function waitForReceipt(hash, retries = 40) {
  for (let i = 0; i < retries; i++) {
    try {
      const receipt = await window.ethereum.request({
        method: 'eth_getTransactionReceipt',
        params: [hash],
      });
      if (receipt && receipt.status === '0x1') return receipt;
      if (receipt && receipt.status === '0x0') throw new Error('Transaction reverted on-chain');
    } catch (e) {
      if (e.message === 'Transaction reverted on-chain') throw e;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  return null; // Timeout — proceed anyway (testnet can be slow)
}

// ── DEMO MODE ────────────────────────────────────────────────
function startDemo() {
  walletAddress = '0xDEMO';
  showToast('Demo mode — no payment needed!');
  setTimeout(() => startQuiz(), 400);
}

// ── QUIZ ENGINE ─────────────────────────────────────────────
function startQuiz() {
  document.getElementById('landing').style.display = 'none';
  document.getElementById('quiz-container').classList.remove('hidden');
  currentQ = 0; score = 0; answers = [];
  renderQuestion();
}

function renderQuestion() {
  const q = QUESTIONS[currentQ];
  document.getElementById('q-label').textContent     = `Question ${currentQ + 1} / ${QUESTIONS.length}`;
  document.getElementById('q-cat-label').textContent = q.category;
  document.getElementById('score-live').textContent  = score;
  document.getElementById('progress-fill').style.width = `${(currentQ / QUESTIONS.length) * 100}%`;
  startTimer();

  document.getElementById('question-area').innerHTML = `
    <div class="question-card">
      <div class="q-category" style="background:${q.color};color:${q.textColor};">${q.category}</div>
      <div class="q-number">Q${currentQ + 1} of ${QUESTIONS.length}</div>
      <div class="q-text">${q.q}</div>
      <div class="options" id="options">
        ${q.opts.map((o, i) => `
          <button class="option" id="opt-${i}" onclick="selectOption(${i})">
            <span class="option-letter">${String.fromCharCode(65 + i)}</span>${o}
          </button>`).join('')}
      </div>
      <div class="q-feedback" id="feedback"></div>
      <button class="next-btn" id="next-btn" onclick="nextQuestion()">
        ${currentQ < QUESTIONS.length - 1 ? 'Next Question →' : 'See My Results 🏆'}
      </button>
    </div>`;
}

function startTimer() {
  clearInterval(timerInterval);
  timeLeft = 30;
  updateTimerUI();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerUI();
    if (timeLeft <= 0) { clearInterval(timerInterval); timeUp(); }
  }, 1000);
}

function updateTimerUI() {
  document.getElementById('timer-val').textContent = timeLeft;
  document.getElementById('timer-chip').classList.toggle('urgent', timeLeft <= 8);
}

function timeUp() {
  lockOptions();
  const q = QUESTIONS[currentQ];
  document.getElementById(`opt-${q.ans}`).classList.add('correct');
  answers.push({ selected: -1, correct: false });
  const fb = document.getElementById('feedback');
  fb.innerHTML = `⏰ Time's up! Correct answer: <strong>${q.opts[q.ans]}</strong>. ${q.explain}`;
  fb.className = 'q-feedback wrong-fb show';
  document.getElementById('next-btn').classList.add('show');
}

function selectOption(idx) {
  clearInterval(timerInterval);
  lockOptions();
  const q = QUESTIONS[currentQ];
  const isCorrect = idx === q.ans;
  document.getElementById(`opt-${idx}`).classList.add(isCorrect ? 'correct' : 'wrong');
  if (!isCorrect) document.getElementById(`opt-${q.ans}`).classList.add('correct');
  if (isCorrect) score++;
  answers.push({ selected: idx, correct: isCorrect });
  document.getElementById('score-live').textContent = score;
  const fb = document.getElementById('feedback');
  fb.innerHTML = isCorrect
    ? `✅ Correct! ${q.explain}`
    : `❌ Correct answer: <strong>${q.opts[q.ans]}</strong>. ${q.explain}`;
  fb.className = `q-feedback ${isCorrect ? 'correct-fb' : 'wrong-fb'} show`;
  document.getElementById('next-btn').classList.add('show');
}

function lockOptions() {
  document.querySelectorAll('.option').forEach(o => { o.classList.add('disabled'); o.onclick = null; });
}

function nextQuestion() {
  currentQ++;
  if (currentQ >= QUESTIONS.length) showResults();
  else renderQuestion();
}

// ── RESULTS ─────────────────────────────────────────────────
function getRank(s) {
  if (s >= 23) return { emoji: '🏆', name: 'OG Legend',     color: '#FFE600', msg: "Absolute OpenGradient expert. Every layer — HACA, TEE, ZKML, SDK, agents — fully mastered. The OG ecosystem needs minds like yours." };
  if (s >= 20) return { emoji: '💎', name: 'Master Node',    color: '#00D4FF', msg: "Outstanding! Deep knowledge of OG's tech and ecosystem. You're ready to build serious dApps and agents on the network." };
  if (s >= 17) return { emoji: '🔮', name: 'TEE Validator',  color: '#B829F7', msg: "Excellent! Strong knowledge of TEE architecture and tools. A few more deep dives and you'll reach Legend status." };
  if (s >= 13) return { emoji: '⛓️', name: 'On-Chain Dev',   color: '#00FF9D', msg: "Good showing! Solid OG knowledge. Revisit the architecture docs and SDK reference to level up." };
  if (s >= 9)  return { emoji: '🌐', name: 'Inference Node', color: '#FF6B00', msg: "Decent start! Read the official docs, especially HACA architecture and developer guides." };
  if (s >= 5)  return { emoji: '📡', name: 'Testnet User',   color: '#6b6b80', msg: "Getting started! Head to docs.opengradient.ai and study before challenging yourself again." };
  return        { emoji: '🌱', name: 'Genesis Node',          color: '#6b6b80', msg: "Every expert starts somewhere! Read through the docs and try again. You've got this!" };
}

function showResults() {
  clearInterval(timerInterval);
  document.getElementById('quiz-container').classList.add('hidden');
  document.getElementById('results').classList.remove('hidden');

  const rank    = getRank(score);
  const pct     = Math.round((score / QUESTIONS.length) * 100);
  const correct = answers.filter(a => a.correct).length;
  const wrong   = answers.filter(a => !a.correct && a.selected !== -1).length;
  const missed  = answers.filter(a => a.selected === -1).length;
  const short   = walletAddress !== '0xDEMO' ? walletAddress.slice(0,6)+'...'+walletAddress.slice(-4) : 'Demo Mode';
  const txLink  = txHash
    ? `<div class="tx-receipt"><span class="tx-receipt-dot"></span>
       <div class="tx-receipt-text">✓ On-chain tx:
         <a href="https://explorer.opengradient.ai/tx/${txHash}" target="_blank">${txHash.slice(0,18)}...</a>
       </div></div>` : '';

  document.getElementById('result-card').innerHTML = `
    <span class="result-emoji">${rank.emoji}</span>
    <div class="result-rank" style="color:${rank.color};">${rank.name}</div>
    <div class="result-score">${score} / ${QUESTIONS.length}</div>
    <div class="result-sub">${pct}% accuracy · ${short}</div>
    ${txLink}
    <div class="result-stats">
      <div class="result-stat"><div class="result-stat-val" style="color:#00FF9D;">${correct}</div><div class="result-stat-lbl">Correct</div></div>
      <div class="result-stat"><div class="result-stat-val" style="color:#fc6c6c;">${wrong}</div><div class="result-stat-lbl">Wrong</div></div>
      <div class="result-stat"><div class="result-stat-val" style="color:#FFE600;">${missed}</div><div class="result-stat-lbl">Timed Out</div></div>
    </div>
    <div class="result-message">${rank.msg}</div>
    <div class="result-btns">
      <button class="result-btn primary" onclick="retryQuiz()">🔄 Retry Quiz</button>
      <a href="https://docs.opengradient.ai/" target="_blank" style="text-decoration:none;"><button class="result-btn secondary">📚 Study the Docs</button></a>
      <a href="https://faucet.opengradient.ai/" target="_blank" style="text-decoration:none;"><button class="result-btn secondary">🚰 Get Testnet ETH</button></a>
      <a href="https://explorer.opengradient.ai" target="_blank" style="text-decoration:none;"><button class="result-btn secondary">🔍 OG Block Explorer</button></a>
    </div>`;

  if (score >= 20) spawnConfetti();
}

function retryQuiz() {
  document.getElementById('results').classList.add('hidden');
  document.getElementById('landing').style.display = 'block';
  const btn = document.getElementById('pay-btn');
  btn.disabled = false;
  btn.textContent = '💸 Pay 0.1 ETH & Start Quiz →';
  btn.style.background = '';
  btn.style.color = '';
}

// ── HELPERS ─────────────────────────────────────────────────
function showStatus(el, html, isError) {
  el.innerHTML = html;
  el.className = 'wallet-status' + (isError ? ' error' : '');
  el.classList.remove('hidden');
}

function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error-toast' : '') + ' show';
  setTimeout(() => t.classList.remove('show'), 3500);
}

function spawnConfetti() {
  const colors = ['#00D4FF','#FF00A0','#B829F7','#00FF9D','#FFE600','#FF6B00'];
  const wrap   = document.getElementById('confetti');
  for (let i = 0; i < 90; i++) {
    const c = document.createElement('div');
    c.className = 'conf';
    c.style.left              = Math.random() * 100 + 'vw';
    c.style.background        = colors[Math.floor(Math.random() * colors.length)];
    c.style.width             = (Math.random() * 8 + 4) + 'px';
    c.style.height            = (Math.random() * 8 + 4) + 'px';
    c.style.animationDuration = (Math.random() * 2 + 2) + 's';
    c.style.animationDelay    = Math.random() * 1.5 + 's';
    c.style.borderRadius      = Math.random() > 0.5 ? '50%' : '2px';
    wrap.appendChild(c);
    setTimeout(() => c.remove(), 5000);
  }
}

// ── BG CANVAS ───────────────────────────────────────────────
(function () {
  const canvas = document.getElementById('bg');
  const ctx    = canvas.getContext('2d');
  let particles = [];

  function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }

  function init() {
    const cols = ['#00D4FF', '#FF00A0', '#B829F7', '#00FF9D'];
    particles = Array.from({ length: 20 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - .5) * .4,
      vy: (Math.random() - .5) * .4,
      size: Math.random() * 2 + 1,
      color: cols[Math.floor(Math.random() * cols.length)],
      alpha: Math.random() * .35 + .15,
    }));
  }

  function frame() {
    ctx.fillStyle = 'rgba(5,5,8,0.12)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    particles.forEach((p1, i) => particles.slice(i + 1).forEach(p2 => {
      const dx = p1.x - p2.x, dy = p1.y - p2.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < 140) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = '#00D4FF';
        ctx.globalAlpha = (1 - d / 140) * .06;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }));
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => { resize(); init(); });
  resize(); init(); frame();
})();

// ── QUESTIONS (25) — Deep Technical Knowledge ───────────────
const QUESTIONS = [
  {
    category: "Architecture", color: "rgba(0,212,255,.15)", textColor: "#00D4FF",
    q: "In HACA, what fundamental problem does OpenGradient solve that prevents standard blockchains from running AI natively?",
    opts: [
      "Gas fees are too high for compute",
      "AI inference is non-deterministic, GPU-dependent, and orders of magnitude more expensive — making full re-execution by all validators impossible",
      "Smart contracts can't store large files",
      "Blockchains don't support floating point math"
    ],
    ans: 1,
    explain: "Standard blockchains assume every validator can cheaply re-execute any transaction. AI inference breaks all three assumptions: it's non-deterministic, requires specialized GPU hardware, and costs 10,000x more than a typical transaction. HACA solves this by separating inference from verification."
  },
  {
    category: "Architecture", color: "rgba(0,212,255,.15)", textColor: "#00D4FF",
    q: "HACA uses a 'verification spectrum'. What are the three trust tiers ordered from fastest to most mathematically certain?",
    opts: [
      "HTTP → IPFS → On-chain",
      "Cryptoeconomic security → TEE attestations → ZKML proofs",
      "Random sampling → Majority vote → Full re-execution",
      "Optimistic → Pessimistic → Neutral"
    ],
    ans: 1,
    explain: "HACA's three tiers: (1) Cryptoeconomic security — stake-based, fastest; (2) TEE attestations — hardware-isolated enclaves with cryptographic signatures; (3) ZKML proofs — zero-knowledge mathematical certainty, slowest but fully trustless. You can mix tiers within a single transaction."
  },
  {
    category: "TEE", color: "rgba(0,255,157,.12)", textColor: "#00FF9D",
    q: "When an OG inference node uses a TEE, what exactly does the attestation cryptographically prove to the verifier?",
    opts: [
      "That the node has enough GPU memory",
      "That the exact model binary ran inside an unmodified, hardware-isolated enclave and produced the signed output — no tampering possible even by the node operator",
      "That the transaction fee was paid",
      "That the model weights are open source"
    ],
    ans: 1,
    explain: "A TEE attestation is a hardware-signed certificate proving: (a) the specific model binary was loaded, (b) it ran inside a genuine Intel SGX or AMD SEV enclave, (c) the enclave was unmodified, and (d) the output was produced by that exact computation. Even the node operator cannot tamper with execution."
  },
  {
    category: "TEE", color: "rgba(0,255,157,.12)", textColor: "#00FF9D",
    q: "What is the key tradeoff between TEE verification and ZKML in OpenGradient's HACA?",
    opts: [
      "TEE is cheaper but slower",
      "TEE relies on trusting hardware manufacturers (Intel/AMD), while ZKML is mathematically trustless but computationally much more expensive to generate",
      "TEE only works for image models",
      "ZKML requires MetaMask, TEE does not"
    ],
    ans: 1,
    explain: "TEE's trust assumption is hardware-based — you trust Intel SGX or AMD SEV hasn't been compromised. ZKML requires zero trust — the proof is mathematically verifiable by anyone — but generating a ZK proof for a large neural network can take hours, making real-time inference impractical today."
  },
  {
    category: "ZKML", color: "rgba(184,41,247,.15)", textColor: "#B829F7",
    q: "Why is ZKML technically difficult to apply to large transformer models like GPT?",
    opts: [
      "Transformers use Python, ZK circuits use Rust",
      "ZK proof generation scales poorly with model size — billions of parameters would take hours to prove, and attention mechanisms are hard to express as arithmetic circuits",
      "ZK proofs can't handle floating point",
      "OpenGradient doesn't support ZKML yet"
    ],
    ans: 1,
    explain: "ZKML requires expressing every computation as an arithmetic circuit. Transformers involve billions of floating-point multiplications, softmax (requires division), and layer norm — all expensive in ZK. Current ZKML is practical for small CNNs but transformer-scale proofs remain an active research frontier."
  },
  {
    category: "Developer SDK", color: "rgba(0,212,255,.15)", textColor: "#00D4FF",
    q: "What does the OpenGradient Python SDK's run_inference() return beyond just the model output?",
    opts: [
      "Only the text response",
      "The model output plus a cryptographic proof object (TEE attestation or ZK proof) that can be submitted on-chain to verify the inference happened correctly",
      "A gas estimate",
      "A JSON schema of the model"
    ],
    ans: 1,
    explain: "run_inference() returns both the result AND a verifiable proof. The proof can be a SGX attestation quote, a ZKML proof, or a cryptoeconomic commitment depending on your selected verification tier. You can then pass this proof to a Solidity contract to trustlessly verify on-chain."
  },
  {
    category: "Developer SDK", color: "rgba(0,212,255,.15)", textColor: "#00D4FF",
    q: "What does og.contract.call_with_inference() enable that a standard Ethereum call cannot do?",
    opts: [
      "Call contracts on other chains",
      "Execute a Solidity function whose inputs include live AI inference results — verified on-chain atomically in the same transaction",
      "Pay gas in $OPG tokens",
      "Deploy contracts without Solidity"
    ],
    ans: 1,
    explain: "This is OG's killer feature. A single atomic transaction can: (1) run an AI model on an inference node, (2) get a verifiable proof, (3) pass the verified output directly as a parameter to a Solidity function. The smart contract trusts the AI output because the proof is verified on-chain in the same tx."
  },
  {
    category: "Agents", color: "rgba(255,107,0,.12)", textColor: "#FF6B00",
    q: "What makes OpenGradient's on-chain AI agents fundamentally different from off-chain agents like LangChain or AutoGPT?",
    opts: [
      "They are faster",
      "Every reasoning step, tool call, and decision is cryptographically verifiable and recorded on-chain — creating a tamper-proof, auditable execution trail",
      "They use a different programming language",
      "They cost less to run"
    ],
    ans: 1,
    explain: "Off-chain agents run on centralized servers — you trust the operator didn't tamper with behavior. OG agents run with TEE or ZK verification on every inference step. The entire execution — every prompt, every tool call, every decision — is verifiable on-chain. Critical for autonomous DeFi agents managing real funds."
  },
  {
    category: "Agents", color: "rgba(255,107,0,.12)", textColor: "#FF6B00",
    q: "AlphaSense in OpenGradient wraps AI workflows as agent tools. What does this enable for a DeFi trading agent?",
    opts: [
      "It enables the agent to buy NFTs",
      "The agent can invoke verified on-chain ML models (price prediction, risk scoring, sentiment analysis) as trusted tool calls with cryptographically proven results — not black-box API responses",
      "It gives the agent a UI",
      "It converts Python to Solidity"
    ],
    ans: 1,
    explain: "AlphaSense turns verifiable AI inference into composable agent tools. A DeFi agent using AlphaSense gets signed, on-chain-verifiable results — not responses from a black-box API. The DAO or fund manager can audit exactly which model produced which signal and verify it wasn't tampered with."
  },
  {
    category: "MemSync", color: "rgba(255,107,0,.12)", textColor: "#FF6B00",
    q: "What cryptographic property does MemSync add to AI agent memory that vector databases like Pinecone cannot provide?",
    opts: [
      "Faster retrieval",
      "Every memory read/write is signed — you can cryptographically prove a specific fact was stored at a specific time and retrieved completely unmodified",
      "It stores more data",
      "It uses less RAM"
    ],
    ans: 1,
    explain: "Pinecone and similar vector DBs are trusted third parties — you can't prove what they stored or returned. MemSync wraps memory operations with cryptographic proofs: you can prove to a smart contract that your agent's memory at time T contained fact X, and it was not modified between storage and retrieval."
  },
  {
    category: "BitQuant", color: "rgba(255,107,0,.12)", textColor: "#FF6B00",
    q: "BitQuant is OG's quant trading framework. What is its key advantage over traditional quant strategies running on AWS?",
    opts: [
      "Lower latency",
      "Every trading signal is verifiable on-chain — LPs or DAO voters can audit that the bot followed the exact specified model and strategy, not a secretly modified one",
      "It uses more data sources",
      "It trades on more exchanges"
    ],
    ans: 1,
    explain: "The biggest risk in quant funds is strategy drift — the operator secretly changes the model without telling LPs. BitQuant's verifiable inference means every signal comes with a cryptographic proof of which model produced it. LPs can verify the bot runs the agreed-upon strategy, not a substituted one."
  },
  {
    category: "EVM Integration", color: "rgba(255,0,160,.12)", textColor: "#FF00A0",
    q: "How does a Solidity smart contract on OpenGradient consume an AI inference result trustlessly?",
    opts: [
      "It calls an Oracle like Chainlink",
      "It reads from a centralized API",
      "The inference node submits the result + cryptographic proof on-chain. The OG verifier contract checks the proof and only if valid passes the result to your contract — all atomically",
      "The developer hardcodes the result"
    ],
    ans: 2,
    explain: "OG has an on-chain Verifier contract. Flow: (1) inference node runs model, (2) produces result + proof, (3) submits to Verifier, (4) Verifier checks proof (TEE or ZK), (5) verified output passed to your contract. No oracle, no trusted third party — all verified by the EVM itself."
  },
  {
    category: "EVM Integration", color: "rgba(255,0,160,.12)", textColor: "#FF00A0",
    q: "Why can't OpenGradient simply use Chainlink or Pyth oracles to bring AI results on-chain?",
    opts: [
      "Chainlink is too expensive",
      "Oracles report external data via trusted committees — they don't execute arbitrary AI models and can't prove which model ran on which inputs. OG nodes run the model and generate the proof.",
      "Chainlink doesn't support Solidity",
      "OpenGradient has a partnership with Pyth"
    ],
    ans: 1,
    explain: "Chainlink nodes are data reporters — they fetch external data and reach consensus on its value. They can't prove WHAT code ran or HOW a result was computed. OG's inference nodes run the actual model and generate a proof. Oracles say 'trust us'. OG says 'here's a mathematical proof that model M with inputs I produced output O'."
  },
  {
    category: "Funding", color: "rgba(255,230,0,.12)", textColor: "#FFE600",
    q: "Beyond the $8.5M seed raise, what strategic significance did a16z CSX selection give OpenGradient?",
    opts: [
      "Free office space only",
      "Access to a16z's crypto portfolio network and a quality signal that attracted Coinbase Ventures, SV Angel, and high-profile angels like Illia Polosukhin and Balaji",
      "A guaranteed token listing",
      "Priority hiring at a16z companies"
    ],
    ans: 1,
    explain: "a16z CSX is fiercely selective. Selection signals to the entire crypto VC ecosystem that a16z's AI+crypto thesis aligns with OG's approach. This directly facilitated co-investment from Coinbase Ventures and SV Angel, and gave credibility for Illia Polosukhin and Balaji to invest as angels."
  },
  {
    category: "Investors", color: "rgba(184,41,247,.15)", textColor: "#B829F7",
    q: "Illia Polosukhin co-authored 'Attention Is All You Need'. Why is his OG investment strategically significant?",
    opts: [
      "He provides cheap GPU access",
      "As co-inventor of the architecture powering all modern LLMs (GPT, Claude, Gemini), his endorsement signals foundational AI credibility — and his NEAR experience in decentralized compute maps directly to OG's thesis",
      "He is a famous YouTuber",
      "He manages OpenGradient's Discord"
    ],
    ans: 1,
    explain: "'Attention Is All You Need' (2017) invented the Transformer. Every major LLM runs on this architecture. Illia investing means the person who literally invented the foundation of modern AI believes decentralized, verifiable inference is the correct path forward. His NEAR background adds L1 infrastructure expertise."
  },
  {
    category: "Investors", color: "rgba(184,41,247,.15)", textColor: "#B829F7",
    q: "What structural parallel does Sandeep Nailwal (Polygon co-founder) investing in OG signal?",
    opts: [
      "Both use the same codebase",
      "Polygon solved Ethereum's throughput limitation for transactions; OpenGradient solves Ethereum's inability to run verifiable AI compute — the same playbook one layer higher",
      "Both are based in India",
      "Polygon will merge with OpenGradient"
    ],
    ans: 1,
    explain: "Polygon thesis: Ethereum L1 can't scale transactions → build L2. OG thesis: EVM can't run AI inference trustlessly → build a specialized AI compute layer on top. Sandeep's investment signals recognition of this structural parallel — the same architectural problem applied to AI compute."
  },
  {
    category: "x402 Protocol", color: "rgba(0,212,255,.15)", textColor: "#00D4FF",
    q: "The x402 protocol (originated at Coinbase) solves what specific problem for AI inference payments?",
    opts: [
      "It makes AI faster",
      "It implements HTTP 402 (Payment Required) as a machine-native protocol — an AI agent can pay for inference automatically within the HTTP request itself, no human approval needed",
      "It encrypts model weights",
      "It reduces gas costs"
    ],
    ans: 1,
    explain: "HTTP 402 was reserved in 1996 for 'Payment Required' but never implemented. x402 makes it real: any HTTP server can require a micro-payment before serving a response. For AI, autonomous agents pay for inference calls programmatically — no human approval, no subscription, no API key. Pure pay-per-inference, machine-to-machine."
  },
  {
    category: "Neuro Stack", color: "rgba(184,41,247,.15)", textColor: "#B829F7",
    q: "What is the architectural purpose of Neuro Stack vs deploying on OG's mainnet directly?",
    opts: [
      "It is cheaper",
      "Neuro Stack lets you deploy a sovereign AI-enabled appchain with your own validator set, token economics, and governance — while inheriting OG's battle-tested AI inference primitives",
      "It has better graphics",
      "It only works with Python"
    ],
    ans: 1,
    explain: "Think Neuro Stack like Cosmos SDK but for AI-first chains. Instead of sharing OG's validator set and block space, you get your own: token, governance, inference verification policy, fee structure. But you inherit OG's AI inference layer for free. Ideal for AI agent DAOs or vertical-specific AI networks."
  },
  {
    category: "Model Hub", color: "rgba(0,255,157,.12)", textColor: "#00FF9D",
    q: "What is the key economic difference between OG's Model Hub and Hugging Face?",
    opts: [
      "OG models are faster to download",
      "On OG's Model Hub, every inference call is attribution-tracked and model creators earn fees automatically via smart contract — Hugging Face has no native payment or verifiable attribution layer",
      "Hugging Face charges more",
      "OG Model Hub only hosts small models"
    ],
    ans: 1,
    explain: "Hugging Face is a hosting platform with no native payment rails. OG's Model Hub registers models as on-chain entities. Every time someone pays to run inference on your model, payment flows to your address automatically via smart contract. Model creators build sustainable revenue without intermediaries."
  },
  {
    category: "Devnet", color: "rgba(255,0,160,.12)", textColor: "#FF00A0",
    q: "When adding OpenGradient Testnet to MetaMask, which hex Chain ID must you enter — and why does capitalisation matter?",
    opts: [
      "0x1 — Ethereum Mainnet",
      "0x29f8 (decimal 10744) — MetaMask returns lowercase hex so comparisons must be case-insensitive or lowercase",
      "0xA — Polygon",
      "0x38 — BSC"
    ],
    ans: 1,
    explain: "OG Testnet Chain ID is 10744 = 0x29f8 hex. MetaMask always returns chain IDs in lowercase. If your code compares against '0x29F8' using strict equality it will fail even when you're on the right network. Always use .toLowerCase() on both sides of the comparison."
  },
  {
    category: "Architecture", color: "rgba(0,212,255,.15)", textColor: "#00D4FF",
    q: "What does 'heterogeneous' mean in HACA — what exactly is heterogeneous?",
    opts: [
      "The team members are from different countries",
      "The compute resources — HACA routes to different hardware (CPU nodes, GPU clusters, TEE enclaves) AND different verification methods (cryptoeconomic, TEE, ZKML) based on each job's requirements",
      "The smart contracts use different languages",
      "The validators have different token stakes"
    ],
    ans: 1,
    explain: "HACA has: lightweight CPU nodes (fast, cheap, simple models), GPU clusters (LLMs), TEE-enabled nodes (privacy + attestation), and ZKML prover nodes (mathematically certain, slow). The scheduler routes each inference to the optimal combination based on cost, latency, and verification requirements specified by the dApp."
  },
  {
    category: "Agents", color: "rgba(255,107,0,.12)", textColor: "#FF6B00",
    q: "What does 'composable verified inference' mean in practice for a DeFi protocol using OG?",
    opts: [
      "Agents can compose music",
      "Multiple verified AI inference calls can be chained — risk model → portfolio optimizer → execution agent — where each step's output is cryptographically proven before the next step consumes it",
      "Agents can compose NFTs",
      "It means parallel execution only"
    ],
    ans: 1,
    explain: "Example: Step 1 — market risk model (TEE-verified). Step 2 — feed verified risk output into a portfolio optimizer (ZKML-proven). Step 3 — pass verified allocation to an execution agent. Each step's proof is checked before the next runs. An auditable, trustless AI pipeline — impossible with existing oracle or off-chain agent tools."
  },
  {
    category: "TEE", color: "rgba(0,255,157,.12)", textColor: "#00FF9D",
    q: "What happens if an OS or node operator tries to read model input data from inside a running TEE?",
    opts: [
      "They can read it with root access",
      "The TEE's memory encryption hardware blocks all external access — the OS, hypervisor, and operator all see only ciphertext. This is enforced at the CPU level, not software.",
      "They need a special API key",
      "The data is deleted after reading"
    ],
    ans: 1,
    explain: "Intel SGX and AMD SEV encrypt enclave memory pages with keys that never leave the CPU hardware. Even with root/kernel access, the OS sees only ciphertext. You can run sensitive AI inference (medical data, trading strategies, personal data) on an untrusted third-party node with provable data privacy."
  },
  {
    category: "Funding", color: "rgba(255,230,0,.12)", textColor: "#FFE600",
    q: "OpenGradient was formerly Vanna Laboratories. What does the rebrand to 'OpenGradient' communicate?",
    opts: [
      "The founders originally built a wine app",
      "The rename signals a pivot toward open, permissionless infrastructure — 'Open' means accessible/decentralized, 'Gradient' is core ML vocabulary (gradient descent trains every neural network)",
      "They ran out of money and rebranded",
      "The original founding team left"
    ],
    ans: 1,
    explain: "'Vanna' suggests a specific product. 'OpenGradient' is an infrastructure brand — 'Open' = permissionless/decentralized, 'Gradient' = ML-native (gradient descent trains all neural networks). The rename is a mission statement: not a product, but the open infrastructure layer for all AI on blockchain. Founded NYC, 2023."
  },
  {
    category: "Developer SDK", color: "rgba(0,212,255,.15)", textColor: "#00D4FF",
    q: "If a Solidity contract must reject a trade when AI confidence falls below 85%, how does OG make this trustlessly enforceable on-chain?",
    opts: [
      "Manually check the score off-chain and submit it",
      "The contract calls OG's verified inference interface, receives the confidence score WITH a cryptographic proof, verifies the proof on-chain, then enforces the threshold — no trusted intermediary at any step",
      "Use a multisig wallet to approve each trade",
      "Call an external API in the constructor"
    ],
    ans: 1,
    explain: "Verifiable AI in action: (1) Solidity: require(verifiedScore >= 85). (2) OG runs model, produces score + proof. (3) Contract calls OG verifier, proof checked by EVM. (4) Verified score compared to threshold. (5) Trade executes or reverts — entirely trustless. No one can fake a high-confidence score because the proof is checked by the EVM itself."
  },
];
