// Wyronix V3 - Liquid Glass Trinity
// Lightweight interactions: section navigation, chat simulation, modal control, dynamic island pulse

// Helpers
const qs = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

// Elements
const navItems = qsa('.nav-item[data-target]');
const chatInput = qs('#chatInput');
const sendBtn = qs('#sendCommand');
const chatHistory = qs('#chatHistory');
const promptPills = qsa('.prompt-pill');
const blueprintModal = qs('#blueprintModal');
const modalClose = qs('#modalClose');
const closeBlueprint = qs('#closeBlueprint');
const initializeSystemBtn = qs('#initializeSystem');
const islandStatus = qs('#islandStatus');
const trinityPulse = qs('#trinityPulse');
const deployButton = qs('#deployButton');

// Smooth scroll to section
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Nav interactions
navItems.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    navItems.forEach((n) => n.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.target;
    if (target === 'blueprint' && blueprintModal) {
      blueprintModal.classList.add('open');
      return;
    }
    scrollToSection(target);
  });
});

// Chat
function addMessage(text, role = 'ai') {
  if (!chatHistory) return;
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role === 'user' ? 'user-message' : 'ai-message'}`;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  wrapper.innerHTML = `
    <div class="message-avatar">
      <i class="fas fa-${role === 'user' ? 'user' : 'robot'}"></i>
    </div>
    <div class="message-content">
      <p>${text}</p>
      <span class="message-time">${time}</span>
    </div>
  `;
  chatHistory.appendChild(wrapper);
  chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
}

function sendMessage() {
  if (!chatInput || !chatHistory) return;
  const text = chatInput.value.trim();
  if (!text) return;
  addMessage(text, 'user');
  chatInput.value = '';

  // Simulated response
  setTimeout(() => {
    const responses = [
      'Trinity acknowledged. Running multi-agent pipeline.',
      'Search Hub scanning live sources. Analyst Hub synthesizing signals.',
      'Developer Hub preparing deployment scripts.',
      'All hubs synced. Rendering executive summary.'
    ];
    const reply = responses[Math.floor(Math.random() * responses.length)];
    addMessage(reply, 'ai');
  }, 900 + Math.random() * 800);
}

if (sendBtn) sendBtn.addEventListener('click', sendMessage);
if (chatInput) {
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });
}

// Quick prompts
promptPills.forEach((pill) => {
  pill.addEventListener('click', () => {
    const prompt = pill.dataset.prompt || pill.textContent.trim();
    if (chatInput) {
      chatInput.value = prompt;
      chatInput.focus();
    }
    scrollToSection('market');
  });
});

// Blueprint modal
function closeModal() {
  if (blueprintModal) blueprintModal.classList.remove('open');
}
if (modalClose) modalClose.addEventListener('click', closeModal);
if (closeBlueprint) closeBlueprint.addEventListener('click', closeModal);

// Initialize system pulse
if (initializeSystemBtn) {
  initializeSystemBtn.addEventListener('click', () => {
    if (islandStatus) islandStatus.textContent = 'System: Initializing…';
    if (trinityPulse) trinityPulse.classList.add('active');
    setTimeout(() => {
      if (islandStatus) islandStatus.textContent = 'System: Operational';
      if (trinityPulse) trinityPulse.classList.remove('active');
    }, 2000);
  });
}

// Deploy button feedback
if (deployButton) {
  deployButton.addEventListener('click', () => {
    deployButton.classList.add('pulse');
    addMessage('Deploying to Vercel… Build pipeline engaged.', 'ai');
    setTimeout(() => deployButton.classList.remove('pulse'), 1500);
  });
}

// Dynamic island default state
window.addEventListener('load', () => {
  scrollToSection('dashboard');
});

