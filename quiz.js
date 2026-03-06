/* ═══════════════════════════════════════════════════════════
   OG QUIZ — quiz.js
   OpenGradient Testnet: Chain ID 10744
   RPC: https://eth-devnet.opengradient.ai
════════════════════════════════════════════════════════════ */

// ── NETWORK CONFIG ──────────────────────────────────────────
const OG_NETWORK = {
  chainId:     '0x29F8',           // 10744 in hex
  chainName:   'OpenGradient Testnet',
  rpcUrls:     ['https://eth-devnet.opengradient.ai'],
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  blockExplorerUrls: ['https://explorer.opengradient.ai'],
};

// Entry fee: 0.1 ETH in wei (hex)
const ENTRY_FEE_WEI = '0x16345785D8A0000'; // 0.1 ETH
// Treasury address — replace with your own wallet to receive fees
const TREASURY = '0x0000000000000000000000000000000000000001';

// ── STATE ───────────────────────────────────────────────────
let walletAddress = '';
let txHash = '';
let currentQ = 0, score = 0, answers = [];
let timerInterval = null, timeLeft = 30;
let demoMode = false;

// ── WALLET CONNECT ──────────────────────────────────────────
async function connectWallet() {
  const btn = document.getElementById('connect-btn');
  const statusEl = document.getElementById('wallet-status');

  if (typeof window.ethereum === 'undefined') {
    showStatus(statusEl, '❌ MetaMask not detected. Please install it from metamask.io', true);
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Connecting...';

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    walletAddress = accounts[0];
    const short = walletAddress.slice(0,6) + '...' + walletAddress.slice(-4);
    showStatus(statusEl, `✓ Connected: ${short}`, false);
    btn.textContent = `✓ ${short}`;
    btn.style.background = 'linear-gradient(135deg,#00FF9D,#00D4FF)';
    btn.style.color = '#050508';

    // Show next step
    document.getElementById('step-network').classList.remove('hidden');
    showToast('Wallet connected! Now switch to OG Testnet.');

    // Listen for account changes
    window.ethereum.on('accountsChanged', (accs) => {
      if (accs.length === 0) location.reload();
      else { walletAddress = accs[0]; }
    });

  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Connect MetaMask';
    if (err.code === 4001) showStatus(statusEl, '❌ Connection rejected by user', true);
    else showStatus(statusEl, `❌ Error: ${err.message}`, true);
  }
}

// ── SWITCH NETWORK ───────────────────────────────────────────
async function switchNetwork() {
  const btn = document.getElementById('network-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Switching network...';

  try {
    // Try switching first (works if already added)
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: OG_NETWORK.chainId }],
    });
    onNetworkSwitched();

  } catch (err) {
    if (err.code === 4902 || err.code === -32603) {
      // Chain not added yet — add it
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
      showToast('❌ ' + err.message, true);
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

// ── PAY & START ──────────────────────────────────────────────
async function payAndStart() {
  const btn = document.getElementById('pay-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Confirm in MetaMask...';

  try {
    // Verify correct network
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (chainId !== OG_NETWORK.chainId) {
      showToast('❌ Please switch to OpenGradient Testnet first', true);
      btn.disabled = false;
      btn.textContent = '💸 Pay 0.1 ETH & Start Quiz →';
      return;
    }

    // Send transaction
    const hash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: walletAddress,
        to:   TREASURY,
        value: ENTRY_FEE_WEI,
        gas:  '0x5208', // 21000
        data: '0x4f47517569z', // "OGQuiz" marker in hex (optional memo)
      }],
    });

    txHash = hash;
    btn.textContent = '⏳ Waiting for confirmation...';
    showToast('Transaction sent! Waiting...');

    // Poll for receipt
    await waitForReceipt(hash);

    btn.textContent = '✓ Paid! Loading quiz...';
    btn.style.background = 'linear-gradient(135deg,#00FF9D,#00D4FF)';
    btn.style.color = '#050508';
    showToast('✓ 0.1 ETH paid! Quiz unlocked 🎉');
    setTimeout(() => startQuiz(), 1200);

  } catch (err) {
    btn.disabled = false;
    btn.textContent = '💸 Pay 0.1 ETH & Start Quiz →';
    if (err.code === 4001) showToast('❌ Transaction rejected by user', true);
    else showToast('❌ Tx failed: ' + (err.message || 'Unknown error'), true);
  }
}

async function waitForReceipt(hash, retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const receipt = await window.ethereum.request({
        method: 'eth_getTransactionReceipt',
        params: [hash],
      });
      if (receipt && receipt.status === '0x1') return receipt;
      if (receipt && receipt.status === '0x0') throw new Error('Transaction reverted');
    } catch (e) {
      if (e.message === 'Transaction reverted') throw e;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  // Timeout — proceed anyway (testnet can be slow)
  return null;
}

// ── DEMO MODE ────────────────────────────────────────────────
function startDemo() {
  demoMode = true;
  walletAddress = '0xDEMO';
  showToast('Demo mode — no payment needed!');
  setTimeout(() => startQuiz(), 400);
}

// ── QUIZ ─────────────────────────────────────────────────────
function startQuiz() {
  document.getElementById('landing').style.display = 'none';
  document.getElementById('quiz-container').classList.remove('hidden');
  currentQ = 0; score = 0; answers = [];
  renderQuestion();
}

function renderQuestion() {
  const q = QUESTIONS[currentQ];
  document.getElementById('q-label').textContent = `Question ${currentQ + 1} / ${QUESTIONS.length}`;
  document.getElementById('q-cat-label').textContent = q.category;
  document.getElementById('score-live').textContent = score;
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
            <span class="option-letter">${String.fromCharCode(65+i)}</span>${o}
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
    : `❌ The correct answer is <strong>${q.opts[q.ans]}</strong>. ${q.explain}`;
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

// ── RESULTS ──────────────────────────────────────────────────
function getRank(s) {
  if (s >= 23) return { emoji:'🏆', name:'OG Legend',      color:'#FFE600', msg:"Absolute OpenGradient expert! You understand every layer — HACA, TEE, investors, SDK. The OG ecosystem needs minds like yours." };
  if (s >= 20) return { emoji:'💎', name:'Master Node',     color:'#00D4FF', msg:"Outstanding! Deep knowledge of OG's tech, mission and ecosystem. You're ready to build serious dApps and agents on the network." };
  if (s >= 17) return { emoji:'🔮', name:'TEE Validator',   color:'#B829F7', msg:"Excellent work! Strong knowledge of TEE architecture, funding, and tools. A few more deep dives and you'll be a Legend." };
  if (s >= 13) return { emoji:'⛓️', name:'On-Chain Dev',    color:'#00FF9D', msg:"Good showing! Solid OG knowledge. Revisit the architecture docs and SDK reference to level up further." };
  if (s >= 9)  return { emoji:'🌐', name:'Inference Node',  color:'#FF6B00', msg:"Decent start! Familiar with some OG concepts. Read the official docs, especially HACA architecture and developer guides." };
  if (s >= 5)  return { emoji:'📡', name:'Testnet User',    color:'#6b6b80', msg:"Getting started! Head to docs.opengradient.ai and study the materials before challenging yourself again." };
  return       { emoji:'🌱', name:'Genesis Node',           color:'#6b6b80', msg:"Every expert starts somewhere! Read through the docs and try again. You've got this!" };
}

function showResults() {
  clearInterval(timerInterval);
  document.getElementById('quiz-container').classList.add('hidden');
  const resultsEl = document.getElementById('results');
  resultsEl.classList.remove('hidden');

  const rank = getRank(score);
  const pct  = Math.round((score / QUESTIONS.length) * 100);
  const correct = answers.filter(a => a.correct).length;
  const wrong   = answers.filter(a => !a.correct && a.selected !== -1).length;
  const missed  = answers.filter(a => a.selected === -1).length;
  const short   = walletAddress !== '0xDEMO' ? walletAddress.slice(0,6)+'...'+walletAddress.slice(-4) : 'Demo Mode';
  const explorerLink = txHash ? `<a href="https://explorer.opengradient.ai/tx/${txHash}" target="_blank">${txHash.slice(0,16)}...</a>` : null;

  document.getElementById('result-card').innerHTML = `
    <span class="result-emoji">${rank.emoji}</span>
    <div class="result-rank" style="color:${rank.color};">${rank.name}</div>
    <div class="result-score">${score} / ${QUESTIONS.length}</div>
    <div class="result-sub">${pct}% accuracy · Wallet: ${short}</div>
    ${explorerLink ? `
    <div class="tx-receipt">
      <span class="tx-receipt-dot"></span>
      <div class="tx-receipt-text">✓ On-chain tx: ${explorerLink}</div>
    </div>` : ''}
    <div class="result-stats">
      <div class="result-stat"><div class="result-stat-val" style="color:var(--green);">${correct}</div><div class="result-stat-lbl">Correct</div></div>
      <div class="result-stat"><div class="result-stat-val" style="color:#fc6c6c;">${wrong}</div><div class="result-stat-lbl">Wrong</div></div>
      <div class="result-stat"><div class="result-stat-val" style="color:var(--yellow);">${missed}</div><div class="result-stat-lbl">Timed Out</div></div>
    </div>
    <div class="result-message">${rank.msg}</div>
    <div class="result-btns">
      <button class="result-btn primary" onclick="retryQuiz()">🔄 Retry Quiz</button>
      <a href="https://docs.opengradient.ai/" target="_blank" style="text-decoration:none;"><button class="result-btn secondary">📚 Study the Docs</button></a>
      <a href="https://github.com/OpenGradient/testnet-faucet" target="_blank" style="text-decoration:none;"><button class="result-btn secondary">🚰 Get Testnet ETH (Faucet)</button></a>
      <a href="https://explorer.opengradient.ai" target="_blank" style="text-decoration:none;"><button class="result-btn secondary">🔍 OG Block Explorer</button></a>
    </div>`;

  if (score >= 20) spawnConfetti();
}

function retryQuiz() {
  document.getElementById('results').classList.add('hidden');
  document.getElementById('landing').style.display = 'block';
  const payBtn = document.getElementById('pay-btn');
  payBtn.disabled = false;
  payBtn.textContent = '💸 Pay 0.1 ETH & Start Quiz →';
  payBtn.style.background = '';
  payBtn.style.color = '';
}

// ── HELPERS ──────────────────────────────────────────────────
function showStatus(el, msg, isError) {
  el.textContent = msg;
  el.className = 'wallet-status' + (isError ? ' error' : '');
  el.classList.remove('hidden');
}

function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error-toast' : '') + ' show';
  setTimeout(() => t.classList.remove('show'), 3200);
}

function spawnConfetti() {
  const colors = ['#00D4FF','#FF00A0','#B829F7','#00FF9D','#FFE600','#FF6B00'];
  const wrap = document.getElementById('confetti');
  for (let i = 0; i < 80; i++) {
    const c = document.createElement('div');
    c.className = 'conf';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.width  = (Math.random() * 8 + 4) + 'px';
    c.style.height = (Math.random() * 8 + 4) + 'px';
    c.style.animationDuration = (Math.random() * 2 + 2) + 's';
    c.style.animationDelay   = Math.random() * 1.5 + 's';
    c.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    wrap.appendChild(c);
    setTimeout(() => c.remove(), 5000);
  }
}

// ── BG CANVAS ─────────────────────────────────────────────────
(function() {
  const canvas = document.getElementById('bg');
  const ctx = canvas.getContext('2d');
  let particles = [];
  function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
  function init() {
    const cols = ['#00D4FF','#FF00A0','#B829F7','#00FF9D'];
    particles = Array.from({length:18}, () => ({
      x:Math.random()*canvas.width, y:Math.random()*canvas.height,
      vx:(Math.random()-.5)*.4, vy:(Math.random()-.5)*.4,
      size:Math.random()*2+1, color:cols[Math.floor(Math.random()*cols.length)], alpha:Math.random()*.35+.15
    }));
  }
  function frame() {
    ctx.fillStyle = 'rgba(5,5,8,0.12)'; ctx.fillRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => {
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0)p.x=canvas.width; if(p.x>canvas.width)p.x=0;
      if(p.y<0)p.y=canvas.height; if(p.y>canvas.height)p.y=0;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
      ctx.fillStyle=p.color; ctx.globalAlpha=p.alpha; ctx.fill(); ctx.globalAlpha=1;
    });
    particles.forEach((p1,i) => particles.slice(i+1).forEach(p2 => {
      const dx=p1.x-p2.x, dy=p1.y-p2.y, d=Math.sqrt(dx*dx+dy*dy);
      if(d<140){ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.strokeStyle='#00D4FF';ctx.globalAlpha=(1-d/140)*.06;ctx.stroke();ctx.globalAlpha=1;}
    }));
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', () => { resize(); init(); });
  resize(); init(); frame();
})();

// ── QUESTIONS (25) ────────────────────────────────────────────
const QUESTIONS = [
  { category:"Basics", color:"rgba(0,212,255,.15)", textColor:"#00D4FF",
    q:"What is OpenGradient's primary mission?",
    opts:["Build centralized AI cloud services","Create the first decentralized, verifiable AI infrastructure on-chain","Develop a new programming language for AI","Compete with OpenAI's GPT models"],
    ans:1, explain:"OpenGradient's mission is to democratize AI by building the first permissionless, decentralized platform for AI model hosting, secure inference, agent execution, and dApp deployment — all fully verifiable on-chain." },

  { category:"Funding", color:"rgba(255,230,0,.12)", textColor:"#FFE600",
    q:"How much did OpenGradient raise in its seed round in October 2024?",
    opts:["$2.5 million","$5 million","$8.5 million","$15 million"],
    ans:2, explain:"OpenGradient raised $8.5M in a seed round led by a16z CSX with participation from Coinbase Ventures, SV Angel, Foresight Ventures, and notable angel investors." },

  { category:"Investors", color:"rgba(184,41,247,.15)", textColor:"#B829F7",
    q:"Which accelerator selected OpenGradient for its Fall 2024 cohort?",
    opts:["Y Combinator","a16z CSX (Crypto Startup Accelerator)","Binance Labs","Draper Associates"],
    ans:1, explain:"OpenGradient was selected for the a16z Crypto Startup Accelerator (CSX) Fall 2024 program in NYC. a16z CSX invests at least $500K in each selected company." },

  { category:"Technology", color:"rgba(0,255,157,.12)", textColor:"#00FF9D",
    q:"What does HACA stand for in OpenGradient's architecture?",
    opts:["High-Accuracy Chain Architecture","Heterogeneous AI Compute Architecture","Hybrid Autonomous Computing Array","Hierarchical AI Contract Architecture"],
    ans:1, explain:"HACA stands for Heterogeneous AI Compute Architecture. It's OpenGradient's multi-layer system that routes AI inference to the right hardware based on security and speed." },

  { category:"Technology", color:"rgba(0,255,157,.12)", textColor:"#00FF9D",
    q:"What technology provides cryptographic proof that AI inference ran inside a secure, unmodified enclave?",
    opts:["Zero-Knowledge Proofs only","Trusted Execution Environments (TEE)","Homomorphic Encryption","Multi-Party Computation"],
    ans:1, explain:"Trusted Execution Environments (TEE) are hardware-isolated secure enclaves that cryptographically sign every AI output, proving the model ran unmodified and untampered." },

  { category:"Blockchain", color:"rgba(255,0,160,.12)", textColor:"#FF00A0",
    q:"What is the Chain ID of OpenGradient's testnet?",
    opts:["1337","8453","10744","42161"],
    ans:2, explain:"OpenGradient Testnet has Chain ID 10744 (0x29F8 in hex). The RPC URL is https://eth-devnet.opengradient.ai and the native currency symbol is ETH." },

  { category:"Blockchain", color:"rgba(255,0,160,.12)", textColor:"#FF00A0",
    q:"What type of blockchain does OpenGradient use?",
    opts:["Solana-compatible","Bitcoin Layer 2","EVM-compatible (Ethereum Virtual Machine)","Cosmos-based"],
    ans:2, explain:"OpenGradient runs on an EVM-compatible blockchain, meaning developers can call AI models directly from Solidity smart contracts with no special tooling." },

  { category:"Investors", color:"rgba(184,41,247,.15)", textColor:"#B829F7",
    q:"Which co-inventor of the Transformer architecture is an angel investor in OpenGradient?",
    opts:["Yann LeCun","Geoffrey Hinton","Illia Polosukhin (NEAR founder)","Andrew Ng"],
    ans:2, explain:"Illia Polosukhin, co-founder of NEAR Protocol, co-invented the Transformer architecture powering all modern LLMs — and is an angel investor in OpenGradient." },

  { category:"Investors", color:"rgba(184,41,247,.15)", textColor:"#B829F7",
    q:"Balaji Srinivasan, an angel investor in OpenGradient, was previously best known as:",
    opts:["CTO of Google","CTO of Coinbase","CEO of Ripple","Founder of Ethereum"],
    ans:1, explain:"Balaji Srinivasan is the former CTO of Coinbase and author of 'The Network State'. He is one of OpenGradient's high-profile angel investors." },

  { category:"Products", color:"rgba(255,107,0,.12)", textColor:"#FF6B00",
    q:"What is MemSync in OpenGradient's ecosystem?",
    opts:["A blockchain wallet","A long-term memory layer for AI with persistent context management","A DEX for $OPG tokens","A GPU rental marketplace"],
    ans:1, explain:"MemSync is OpenGradient's long-term memory layer for AI. It provides a REST API for persistent context, fact extraction, semantic search — with cryptographic proof of authenticity." },

  { category:"Products", color:"rgba(255,107,0,.12)", textColor:"#FF6B00",
    q:"What is BitQuant in the OpenGradient ecosystem?",
    opts:["A Bitcoin trading bot","An open-source AI agent framework for quantitative trading using on-chain ML models","A stablecoin pegged to BTC","A block explorer"],
    ans:1, explain:"BitQuant is OpenGradient's open-source AI agent framework for quant trading. It uses on-chain ML models for market analytics, portfolio management, and autonomous trade execution." },

  { category:"Technology", color:"rgba(0,255,157,.12)", textColor:"#00FF9D",
    q:"In OpenGradient's HACA, what do 'Inference Nodes' primarily do?",
    opts:["Verify transaction signatures","Store blockchain state","Run AI model inference with specialized GPU hardware","Distribute token rewards"],
    ans:2, explain:"Inference nodes are specialized for running AI models on GPU hardware. This separation of inference from verification is a core HACA design principle." },

  { category:"Technology", color:"rgba(0,255,157,.12)", textColor:"#00FF9D",
    q:"Which verification methods does OpenGradient's HACA support?",
    opts:["Only TEE-based","Only Zero-Knowledge Proofs","A spectrum: TEE attestations, ZKML, and cryptoeconomic security","Only on-chain re-execution"],
    ans:2, explain:"HACA supports a full spectrum: TEE attestations, ZKML for mathematical certainty, and cryptoeconomic security. You can even mix methods within a single transaction." },

  { category:"Developers", color:"rgba(0,212,255,.15)", textColor:"#00D4FF",
    q:"What programming language is the OpenGradient SDK currently available in?",
    opts:["JavaScript only","Rust","Python (TypeScript in development)","Go"],
    ans:2, explain:"The OpenGradient SDK is available for Python with a TypeScript version in development. It includes a Python library and a CLI tool called 'opengradient'." },

  { category:"Developers", color:"rgba(0,212,255,.15)", textColor:"#00D4FF",
    q:"What is AlphaSense in OpenGradient's developer stack?",
    opts:["A financial data API","A tool that wraps verifiable AI workflows to give AI agents powerful on-chain signals","A hardware monitoring dashboard","A smart contract auditing tool"],
    ans:1, explain:"AlphaSense wraps verifiable AI workflows and exposes them as tools for AI agents — giving your agent 'superpowers' with on-chain verified signals." },

  { category:"Basics", color:"rgba(0,212,255,.15)", textColor:"#00D4FF",
    q:"What core problem does OpenGradient solve that centralized AI providers cannot?",
    opts:["Faster response times","Complete cryptographic verifiability of every AI inference — proof outputs weren't tampered with","Lower API pricing","Better model quality"],
    ans:1, explain:"The core problem is trust. With centralized AI you can't verify outputs. OpenGradient provides cryptographic proof of every single inference — something no centralized provider offers." },

  { category:"Blockchain", color:"rgba(255,0,160,.12)", textColor:"#FF00A0",
    q:"What is the RPC URL for OpenGradient's developer testnet?",
    opts:["https://rpc.opengradient.ai","https://eth-devnet.opengradient.ai","https://testnet.opengradient.io","https://api.og-chain.net"],
    ans:1, explain:"The OpenGradient testnet RPC URL is https://eth-devnet.opengradient.ai — used when adding OG to MetaMask or initializing the Python SDK." },

  { category:"Products", color:"rgba(255,107,0,.12)", textColor:"#FF6B00",
    q:"What is the OpenGradient Model Hub?",
    opts:["A GPU marketplace","A community model registry to discover, deploy, and monetize open-source AI models on-chain","An NFT collection","A smart contract audit service"],
    ans:1, explain:"The Model Hub is OG's decentralized model repository. Think Hugging Face — but on-chain, permissionless, and with ownership attribution." },

  { category:"Investors", color:"rgba(184,41,247,.15)", textColor:"#B829F7",
    q:"Sandeep Nailwal, an angel investor in OpenGradient, co-founded which blockchain project?",
    opts:["Solana","Avalanche","Polygon","Arbitrum"],
    ans:2, explain:"Sandeep Nailwal is co-founder of Polygon, one of Ethereum's largest L2 ecosystems. He invested in OpenGradient's seed round." },

  { category:"Technology", color:"rgba(0,255,157,.12)", textColor:"#00FF9D",
    q:"Why does OpenGradient NOT ask every validator to re-run AI inferences?",
    opts:["To save storage","AI inference is computationally expensive, requires GPUs, and is non-deterministic — making full re-execution impractical","Copyright concerns","Would slow token transfers"],
    ans:1, explain:"Unlike simple transactions, AI inference costs orders of magnitude more, needs specialized GPUs, and is non-deterministic. Dedicated inference nodes run models and full nodes verify proofs instead." },

  { category:"Developers", color:"rgba(0,212,255,.15)", textColor:"#00D4FF",
    q:"What is x402 in OpenGradient's ecosystem?",
    opts:["An internal error code","A payments protocol for the internet built on HTTP enabling verifiable LLM inference with payment flows","A transaction type","A smart contract name"],
    ans:1, explain:"x402 is an HTTP-based payments protocol (originally from Coinbase) that OpenGradient uses as a gateway for verifiable LLM inference with payment flows built in." },

  { category:"Products", color:"rgba(255,107,0,.12)", textColor:"#FF6B00",
    q:"What is Neuro Stack in OpenGradient?",
    opts:["A GPU hardware stack","Technology to spin up your own sovereign AI-enabled blockchain for agents or apps","A frontend UI kit","A staking mechanism"],
    ans:1, explain:"Neuro Stack lets anyone deploy their own sovereign AI-enabled blockchain — ideal for building specialized chains for AI agents or AI-powered applications." },

  { category:"Basics", color:"rgba(0,212,255,.15)", textColor:"#00D4FF",
    q:"What was OpenGradient's previous company name before rebranding?",
    opts:["DeepChain Labs","Vanna Laboratories","Gradient Protocol","ChainML Inc"],
    ans:1, explain:"OpenGradient was formerly known as Vanna Laboratories before rebranding. It was founded in New York City in 2023." },

  { category:"Developers", color:"rgba(0,212,255,.15)", textColor:"#00D4FF",
    q:"The OpenGradient Agent Stack is compatible with which popular agent frameworks?",
    opts:["Only OG's own framework","LangChain and OpenAI Swarm","TensorFlow and PyTorch","AutoGPT only"],
    ans:1, explain:"The OG Agent Stack is compatible with LangChain and OpenAI Swarm, making it a plug-in replacement for centralized execution in existing agent setups." },

  { category:"Blockchain", color:"rgba(255,0,160,.12)", textColor:"#FF00A0",
    q:"Which on-chain use cases does OpenGradient explicitly enable through verifiable AI?",
    opts:["Only chatbots","Risk management, AMM optimization, AI agents, Sybil resistance, DeFi mechanism design — all cryptographically proven","Only image generation","Only text summarization"],
    ans:1, explain:"OpenGradient enables high-stakes use cases: risk management, ML optimization, AI agents, Sybil resistance, DeFi, AMM optimization — all with cryptographic verifiability built-in." },
];
