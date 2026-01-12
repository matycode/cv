/**
 * WYRONIX V3 - CORE CLIENT
 * Mode: STEALTH / CONSOLE
 */

class WyronixEngine {
  constructor() {
      this.API_URL = "http://localhost:8000/api/v1"; 
      
      this.state = {
          status: 'STANDBY', 
          idea: '',
          sessionId: null
      };
      
      // Monetization: Check localStorage for premium status
      this.isPremium = localStorage.getItem('isPremium') === 'true';
      this.searchCount = parseInt(localStorage.getItem('wyronix_search_count') || '0');
      
      // MAP DOM ELEMENTS
      // We use '?' to safely select elements even if they are missing
      this.dom = {
          input: document.getElementById('userInput'),
          island: document.getElementById('dynamicIsland'),
          islandText: document.getElementById('islandText'),
          islandSpinner: document.getElementById('islandSpinner'),
          islandDot: document.getElementById('islandStatusDot'),
          
          // Cards
          cardSearch: document.getElementById('cardSearch'),
          cardAnalyst: document.getElementById('cardAnalyst'),
          cardDev: document.getElementById('cardDev'),
          
          // Outputs
          terminal: document.getElementById('searchTerminal'),
          tags: document.getElementById('searchTags'),
          gauges: document.getElementById('analystGauges'),
          verdict: document.getElementById('analystVerdict'),
          fileTree: document.getElementById('fileTree'),
          codePreview: document.getElementById('codePreview'),
          btnExport: document.getElementById('btnExport'),
          
          // Modal
          modal: document.getElementById('blueprintModal'),
          modalContent: document.getElementById('modalContent'),
          btnClose: document.getElementById('btnCloseModal'),
          
          // Paywall
          paywallModal: document.getElementById('paywallModal'),
          btnClosePaywall: document.getElementById('btnClosePaywall'),
          btnUpgrade: document.getElementById('btnUpgrade'),
          
          // Isometric Bars
          progressHeat: document.getElementById('progressHeat'),
          progressROI: document.getElementById('progressROI')
      };

      this.initListeners();
      this.checkServerHealth();
      console.log("[SYSTEM] Wyronix Client Loaded.");
  }

  initListeners() {
      // LISTENER 1: The Enter Key (Main Trigger)
      if (this.dom.input) {
          this.dom.input.addEventListener('keypress', (e) => {
              if (e.key === 'Enter') {
                  console.log("[INPUT] Enter key detected.");
                  this.initiateRealProtocol();
              }
          });
      } else {
          console.error("❌ Critical Error: Input box 'userInput' not found in HTML.");
      }
      
      // LISTENER 2: Export Button
      if (this.dom.btnExport) {
          this.dom.btnExport.addEventListener('click', () => this.downloadRealReport());
      }

      // LISTENER 3: Modal Close
      if (this.dom.btnClose) {
          this.dom.btnClose.addEventListener('click', () => {
              this.dom.modal.classList.add('hidden');
          });
      }
      
      // LISTENER 4: Paywall Close
      if (this.dom.btnClosePaywall) {
          this.dom.btnClosePaywall.addEventListener('click', () => {
              this.dom.paywallModal.classList.add('hidden');
          });
      }
      
      // LISTENER 5: Upgrade Button (Set Stripe URL here)
      if (this.dom.btnUpgrade) {
          this.dom.btnUpgrade.href = 'https://buy.stripe.com/test_xxxxxxxxxxxxx'; // Replace with your Stripe test checkout URL
      }
  }

  async checkServerHealth() {
      try {
          const response = await fetch(`${this.API_URL}/health`);
          if (response.ok) {
              console.log("[NETWORK] Backend is Online.");
              this.updateIsland('idle', 'SYSTEM ONLINE');
              if(this.dom.islandDot) this.dom.islandDot.style.background = '#00ff9d';
          }
      } catch (error) {
          console.warn("[NETWORK] Backend Offline:", error);
          this.updateIsland('idle', 'OFFLINE MODE');
          if(this.dom.islandDot) this.dom.islandDot.style.background = '#ff2a6d';
      }
  }

  async initiateRealProtocol() {
      const idea = this.dom.input.value.trim();
      if (!idea) {
          this.shakeInput();
          return;
      }
      
      // Check quota: Free tier allows 3 searches/day
      if (!this.isPremium && this.searchCount >= 3) {
          this.dom.paywallModal.classList.remove('hidden');
          return;
      }

      console.log(`[ACTION] Initiating sequence for: ${idea}`);
      
      // Increment search counter
      if (!this.isPremium) {
          this.searchCount++;
          localStorage.setItem('wyronix_search_count', this.searchCount.toString());
      }

      // LOCK UI
      this.state.idea = idea;
      this.state.status = 'CONNECTING';
      this.updateIsland('active', 'ESTABLISHING UPLINK...', true);
      this.resetUI();

      try {
          // CALL MIDDLEWARE
          const licenseKey = localStorage.getItem('license_key') || '';
          const headers = {
              'Content-Type': 'application/json'
          };
          if (licenseKey) {
              headers['License-Key'] = licenseKey;
          }
          
          const response = await fetch(`${this.API_URL}/start`, {
              method: 'POST',
              headers: headers,
              body: JSON.stringify({ project_idea: idea })
          });

          if (!response.ok) throw new Error("Server Rejected Connection");

          const data = await response.json();
          console.log("[NETWORK] Session Created:", data.session_id);
          this.state.sessionId = data.session_id;

          // CONNECT SOCKET
          this.connectWebSocket(this.state.sessionId);

      } catch (error) {
          console.error("[ERROR]", error);
          this.updateIsland('idle', 'CONNECTION FAILED');
          this.logToTerminal(`[ERROR] Connection Refused: ${error.message}`);
          if(this.dom.islandDot) this.dom.islandDot.style.background = '#ff2a6d';
      }
  }

  connectWebSocket(sessionId) {
      this.updateIsland('active', 'AWAITING NEURAL FEED...', true);
      
      const socket = new WebSocket(`ws://localhost:8000/ws/${sessionId}`);

      socket.onopen = () => {
          console.log("[SOCKET] Connected.");
          this.logToTerminal("[SYSTEM] Secure Uplink Established.");
      };

      socket.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          this.handleBackendMessage(msg);
      };

      socket.onerror = (error) => {
          console.error("[SOCKET] Error:", error);
          this.logToTerminal("[ERROR] Signal Lost.");
      };

      socket.onclose = () => {
          console.log("[SOCKET] Closed.");
          this.updateIsland('success', 'SEQUENCE COMPLETE', false);
          if(this.dom.btnExport) {
              this.dom.btnExport.classList.remove('hidden');
              this.dom.btnExport.disabled = false;
          }
      };
  }

  handleBackendMessage(msg) {
      // Route traffic to correct card
      switch(msg.agent) {
          case 'SEARCH':
              this.setActiveCard(this.dom.cardSearch);
              if (msg.content) {
                  this.logToTerminal(`> ${msg.content}`);
              }
              if(msg.data && msg.data.tag) this.addTag(msg.data.tag);
              break;

          case 'ANALYST':
              this.completeCard(this.dom.cardSearch);
              this.setActiveCard(this.dom.cardAnalyst);
              if (msg.metrics) {
                  this.dom.gauges.classList.remove('opacity-0');
                  
                  // Update isometric bars with animation
                  const heat = msg.metrics.heat || 0;
                  const roi = msg.metrics.roi || 0;
                  
                  if (this.dom.progressHeat) {
                      this.dom.progressHeat.style.width = heat + '%';
                      if (heat > 70) this.dom.progressHeat.classList.add('intense');
                  }
                  if (this.dom.progressROI) {
                      this.dom.progressROI.style.width = roi + '%';
                      if (roi > 70) this.dom.progressROI.classList.add('intense');
                  }
                  
                  if(document.getElementById('valHeat')) document.getElementById('valHeat').innerText = heat + "%";
                  if(document.getElementById('valROI')) document.getElementById('valROI').innerText = roi + "%";
                  
                  if (msg.metrics.verdict) {
                      this.dom.verdict.innerText = msg.metrics.verdict;
                      this.dom.verdict.classList.remove('hidden');
                  }
              }
              if (msg.content) {
                  this.logToTerminal(`[ANALYST] ${msg.content}`);
              }
              break;

          case 'DEV':
              this.completeCard(this.dom.cardAnalyst);
              this.setActiveCard(this.dom.cardDev);
              if (msg.file) this.addFile(msg.file);
              if (msg.code) this.appendCode(msg.code);
              break;
              
          case 'COMPLETE':
              this.completeCard(this.dom.cardDev);
              this.updateIsland('success', 'SEQUENCE COMPLETE', false);
              break;
              
          case 'ERROR':
              // Display error in terminal
              this.logToTerminal(`[ERROR] ${msg.content || 'Unknown error occurred'}`);
              this.updateIsland('idle', 'ERROR OCCURRED', false);
              if(this.dom.islandDot) this.dom.islandDot.style.background = '#ff2a6d';
              console.error('[BACKEND ERROR]', msg);
              break;
              
          default:
              console.warn('[UNKNOWN AGENT]', msg);
              break;
      }
  }

  /* --- UI HELPERS --- */
  updateIsland(mode, text, showSpinner) {
      this.dom.island.className = `dynamic-island ${mode}`;
      this.dom.islandText.innerText = text;
      if (showSpinner) {
          if(this.dom.islandSpinner) this.dom.islandSpinner.classList.remove('hidden');
          if(this.dom.islandDot) this.dom.islandDot.classList.add('hidden');
      } else {
          if(this.dom.islandSpinner) this.dom.islandSpinner.classList.add('hidden');
          if(this.dom.islandDot) this.dom.islandDot.classList.remove('hidden');
      }
  }

  setActiveCard(card) {
      if(!card) return;
      [this.dom.cardSearch, this.dom.cardAnalyst, this.dom.cardDev].forEach(c => {
          if(c) c.style.opacity = '0.4';
      });
      card.style.opacity = '1';
      card.classList.add('active-card');
  }

  completeCard(card) {
      if(!card) return;
      card.classList.remove('active-card');
      card.style.borderColor = 'rgba(255,255,255,0.1)';
      // Restore opacity
      [this.dom.cardSearch, this.dom.cardAnalyst, this.dom.cardDev].forEach(c => {
          if(c) c.style.opacity = '1';
      });
  }

  logToTerminal(text) {
      if(!this.dom.terminal) return;
      const p = document.createElement('div');
      p.className = 'log-entry';
      p.innerText = text;
      this.dom.terminal.appendChild(p);
      this.dom.terminal.scrollTop = this.dom.terminal.scrollHeight;
  }

  addTag(text) {
      if(!this.dom.tags) return;
      const span = document.createElement('span');
      span.className = 'tag';
      span.innerText = text;
      this.dom.tags.appendChild(span);
  }

  addFile(filename) {
      if(!this.dom.fileTree) return;
      const div = document.createElement('div');
      div.innerText = '📄 ' + filename;
      div.style.marginBottom = "4px";
      this.dom.fileTree.appendChild(div);
  }

  appendCode(text) {
      if(this.dom.codePreview) this.dom.codePreview.innerText += text;
  }

  shakeInput() {
      this.dom.input.parentElement.style.borderColor = 'var(--accent-red)';
      setTimeout(() => this.dom.input.parentElement.style.borderColor = 'rgba(255,255,255,0.1)', 500);
  }

  resetUI() {
      if(this.dom.terminal) this.dom.terminal.innerHTML = '';
      if(this.dom.tags) this.dom.tags.innerHTML = '';
      if(this.dom.fileTree) this.dom.fileTree.innerHTML = '<div class="tree-root">/root</div>';
      if(this.dom.codePreview) this.dom.codePreview.innerText = '';
      if(this.dom.verdict) this.dom.verdict.classList.add('hidden');
      if(this.dom.gauges) this.dom.gauges.classList.add('opacity-0');
      if(this.dom.btnExport) this.dom.btnExport.classList.add('hidden');
  }
}

// START ENGINE
const Engine = new WyronixEngine();