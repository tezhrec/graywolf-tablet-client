/* =========================================================
   Graywolf APRS Tablet Web Client - Core Application Logic
   ========================================================= */

class GraywolfClient {
  constructor() {
    this.state = {
      stationCallsign: 'GRAYWOLF',
      targetUrl: 'http://10.0.0.122:8080',
      daemonVersion: null,
      status: null,
      conversations: [],
      activeThread: null, // { key, kind, alias, participantCount }
      messages: [],
      lastCursor: null,
      beacons: [],
      quickBeaconId: parseInt(localStorage.getItem('gw_quick_beacon_id') || '1', 10),
      cooldownSeconds: parseInt(localStorage.getItem('gw_beacon_cooldown') || '5', 10),
      cooldownRemaining: 0,
      cooldownTimer: null,
      activeFilter: 'all',
      searchQuery: '',
      soundEnabled: localStorage.getItem('gw_pref_sound') !== 'false',
      hapticEnabled: localStorage.getItem('gw_pref_haptic') !== 'false',
      isConnected: false,
      isAuthenticated: false,
      isTransmitting: false,
      
      // APRS OTA Spots & Radar State
      spots: [],
      spotFilter: 'all',
      spotSearchQuery: '',
      otaStatus: null,
      botCallsign: 'APRSOTA',
      activeDrawerView: 'chats',
      widescreenRadarOpen: false
    };

    this.dom = {};
    this.eventSource = null;
    this.audioCtx = null;
  }

  async init() {
    this.cacheDom();
    this.bindEvents();
    this.initAudioContext();
    this.updateCharMeter();

    // 1. Discover client info and target server
    await this.fetchClientInfo();

    // 2. Check basic daemon connectivity & version
    await this.checkDaemon();

    // 3. Initial full data fetch
    await this.refreshAll();

    // 4. Connect SSE stream and start fast message changelog sync if authenticated
    if (this.state.isAuthenticated) {
      this.connectEventStream();
      this.syncMessagesChangelog().catch(() => {});
    }

    // Fast changelog sync every 1.5 seconds (mirrors Graywolf's internal sync for real-time status/responses)
    setInterval(() => this.syncMessagesChangelog(), 1500);

    // Keepalive and station status poll every 15 seconds
    setInterval(() => this.pollStatus(), 15000);

    // 5. Initial APRS OTA spots & status
    this.fetchOtaStatus().catch(() => {});
    this.fetchOtaSpots().catch(() => {});

    // Polite 60-second polling for APRS OTA spots
    setInterval(() => this.fetchOtaSpots(), 60000);
  }

  cacheDom() {
    this.dom = {
      tacticalBar: document.getElementById('tactical-bar'),
      stationBadge: document.getElementById('station-badge'),
      stationCallsign: document.getElementById('station-callsign'),
      connectionDot: document.getElementById('connection-dot'),
      btnLoginPrompt: document.getElementById('btn-login-prompt'),
      
      // Beacon Trigger Elements
      btnTriggerBeacon: document.getElementById('btn-trigger-beacon'),
      quickBeaconName: document.getElementById('quick-beacon-name'),
      beaconCooldownBadge: document.getElementById('beacon-cooldown-badge'),
      btnBeaconConfig: document.getElementById('btn-beacon-config'),

      // Header actions
      btnToggleDrawer: document.getElementById('btn-toggle-drawer'),
      btnAudioToggle: document.getElementById('btn-audio-toggle'),
      audioIcon: document.getElementById('audio-icon'),
      btnFullscreenToggle: document.getElementById('btn-fullscreen-toggle'),
      btnSettingsOpen: document.getElementById('btn-settings-open'),

      // Drawer Elements
      drawer: document.getElementById('conversation-drawer'),
      searchThreads: document.getElementById('search-threads'),
      btnNewChat: document.getElementById('btn-new-chat'),
      filterTabs: document.querySelectorAll('.filter-tabs .tab-btn'),
      countAll: document.getElementById('count-all'),
      countUnread: document.getElementById('count-unread'),
      conversationList: document.getElementById('conversation-list'),

      // Chat Workspace Elements
      chatWorkspace: document.getElementById('chat-workspace'),
      chatEmptyState: document.getElementById('chat-empty-state'),
      threadPanel: document.getElementById('thread-panel'),
      btnEmptyNewChat: document.getElementById('btn-empty-new-chat'),
      btnEmptyTriggerBeacon: document.getElementById('btn-empty-trigger-beacon'),
      summaryStation: document.getElementById('summary-station'),
      summaryRx: document.getElementById('summary-rx'),
      summaryTx: document.getElementById('summary-tx'),
      summaryBeacon: document.getElementById('summary-beacon'),

      // Active Thread Header
      btnBackToDrawer: document.getElementById('btn-back-to-drawer'),
      activeThreadKey: document.getElementById('active-thread-key'),
      activeThreadKind: document.getElementById('active-thread-kind'),
      activeThreadAlias: document.getElementById('active-thread-alias'),
      activeThreadParticipants: document.getElementById('active-thread-participants'),
      btnDeleteThread: document.getElementById('btn-delete-thread'),

      // Feed & Composer
      messageFeed: document.getElementById('message-feed'),
      cannedScrollList: document.getElementById('canned-scroll-list'),
      formCompose: document.getElementById('form-compose'),
      inputMessage: document.getElementById('input-message'),
      charCount: document.getElementById('char-count'),
      charMeter: document.getElementById('char-meter'),
      btnSendMsg: document.getElementById('btn-send-msg'),
      chkPreferIs: document.getElementById('chk-prefer-is'),
      selectPath: document.getElementById('select-path'),

      // Modals
      modalBeacons: document.getElementById('modal-beacons'),
      btnCloseBeaconModal: document.getElementById('btn-close-beacon-modal'),
      btnCancelBeaconModal: document.getElementById('btn-cancel-beacon-modal'),
      btnSaveBeaconPref: document.getElementById('btn-save-beacon-pref'),
      beaconListContainer: document.getElementById('beacon-list-container'),
      selectCooldown: document.getElementById('select-cooldown'),

      modalNewChat: document.getElementById('modal-new-chat'),
      btnCloseNewChat: document.getElementById('btn-close-new-chat'),
      btnCancelNewChat: document.getElementById('btn-cancel-new-chat'),
      formNewChat: document.getElementById('form-new-chat'),
      newRecipient: document.getElementById('new-recipient'),
      newMessageText: document.getElementById('new-message-text'),

      modalSettings: document.getElementById('modal-settings'),
      btnCloseSettings: document.getElementById('btn-close-settings'),
      btnSaveSettings: document.getElementById('btn-save-settings'),
      diagGwStatus: document.getElementById('diag-gw-status'),
      diagGwCallsign: document.getElementById('diag-gw-callsign'),
      diagGwVersion: document.getElementById('diag-gw-version'),
      diagGwUptime: document.getElementById('diag-gw-uptime'),
      diagSseStatus: document.getElementById('diag-sse-status'),
      diagGwTarget: document.getElementById('diag-gw-target'),
      settingGwTarget: document.getElementById('setting-gw-target'),
      btnSaveTarget: document.getElementById('btn-save-target'),
      formAuth: document.getElementById('form-auth'),
      authUsername: document.getElementById('auth-username'),
      authPassword: document.getElementById('auth-password'),
      btnAuthLogout: document.getElementById('btn-auth-logout'),
      prefSound: document.getElementById('pref-sound'),
      prefHaptic: document.getElementById('pref-haptic'),

      // APRS OTA Spots & Radar Elements
      btnSpotsIndicator: document.getElementById('btn-spots-indicator'),
      spotsTopCount: document.getElementById('spots-top-count'),
      tabViewChats: document.getElementById('tab-view-chats'),
      tabViewSpots: document.getElementById('tab-view-spots'),
      chatsTabBadge: document.getElementById('chats-tab-badge'),
      spotsTabBadge: document.getElementById('spots-tab-badge'),
      chatsView: document.getElementById('chats-view'),
      spotsView: document.getElementById('spots-view'),
      searchSpots: document.getElementById('search-spots'),
      btnRefreshSpots: document.getElementById('btn-refresh-spots'),
      spotFilterTabs: document.querySelectorAll('.spots-filter-tabs .tab-btn'),
      countSpotsAll: document.getElementById('count-spots-all'),
      countSpotsPota: document.getElementById('count-spots-pota'),
      countSpotsSota: document.getElementById('count-spots-sota'),
      spotsList: document.getElementById('spots-list'),

      // Widescreen Radar Panel
      widescreenRadarPanel: document.getElementById('widescreen-radar-panel'),
      radarPanelBadge: document.getElementById('radar-panel-badge'),
      radarPanelList: document.getElementById('radar-panel-list'),
      btnCloseRadarPanel: document.getElementById('btn-close-radar-panel'),

      // OTA Settings
      settingOtaToken: document.getElementById('setting-ota-token'),
      btnToggleTokenMask: document.getElementById('btn-toggle-token-mask'),
      settingOtaBot: document.getElementById('setting-ota-bot'),
      otaStatusDot: document.getElementById('ota-status-dot'),
      otaStatusText: document.getElementById('ota-status-text'),
      btnSaveOtaConfig: document.getElementById('btn-save-ota-config'),

      // Login Modal
      modalLogin: document.getElementById('modal-login'),
      formModalLogin: document.getElementById('form-modal-login'),
      modalLoginUsername: document.getElementById('modal-login-username'),
      modalLoginPassword: document.getElementById('modal-login-password'),
      loginModalTarget: document.getElementById('login-modal-target'),
      loginErrorMsg: document.getElementById('login-error-msg'),
      btnCloseLogin: document.getElementById('btn-close-login'),
      btnCancelLogin: document.getElementById('btn-cancel-login'),

      // Toast container
      toastContainer: document.getElementById('toast-container')
    };
  }

  bindEvents() {
    // Top Bar Actions
    this.dom.btnTriggerBeacon.addEventListener('click', () => this.handleTriggerQuickBeacon());
    this.dom.btnBeaconConfig.addEventListener('click', () => this.openBeaconModal());
    this.dom.btnSettingsOpen.addEventListener('click', () => this.openSettingsModal());
    this.dom.btnLoginPrompt.addEventListener('click', () => this.openLoginModal());
    this.dom.stationBadge.addEventListener('click', () => {
      if (!this.state.isAuthenticated) this.openLoginModal();
      else this.openSettingsModal();
    });
    this.dom.btnAudioToggle.addEventListener('click', () => this.toggleAudio());
    this.dom.btnFullscreenToggle.addEventListener('click', () => this.toggleFullscreen());
    this.dom.btnToggleDrawer.addEventListener('click', () => this.toggleDrawer());

    // APRS OTA View Switcher & Top Indicator
    this.dom.tabViewChats.addEventListener('click', () => this.switchDrawerView('chats'));
    this.dom.tabViewSpots.addEventListener('click', () => this.switchDrawerView('spots'));
    this.dom.btnSpotsIndicator.addEventListener('click', () => this.handleSpotsIndicatorClick());

    // Spots Filter Tabs
    this.dom.spotFilterTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        this.dom.spotFilterTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.spotFilter = btn.dataset.spotFilter;
        this.renderSpots();
      });
    });

    // Spots Search Box
    this.dom.searchSpots.addEventListener('input', (e) => {
      this.state.spotSearchQuery = e.target.value.toLowerCase().trim();
      this.renderSpots();
    });

    // Refresh Spots Button
    this.dom.btnRefreshSpots.addEventListener('click', () => {
      this.fetchOtaSpots(true);
    });

    // Close Widescreen Radar
    if (this.dom.btnCloseRadarPanel) {
      this.dom.btnCloseRadarPanel.addEventListener('click', () => {
        this.toggleWidescreenRadar(false);
      });
    }

    // Delegated 1-Tap Chase click handler
    const handleSpotListClick = (e) => {
      const btn = e.target.closest('.btn-chase');
      if (btn) {
        const call = btn.dataset.callsign;
        const spot = this.state.spots.find(s => s.callsign === call);
        this.handleChase(call, spot);
      }
    };
    this.dom.spotsList.addEventListener('click', handleSpotListClick);
    if (this.dom.radarPanelList) {
      this.dom.radarPanelList.addEventListener('click', handleSpotListClick);
    }

    // Settings: APRS OTA Token & Bot
    this.dom.btnToggleTokenMask.addEventListener('click', () => {
      const isPass = this.dom.settingOtaToken.type === 'password';
      this.dom.settingOtaToken.type = isPass ? 'text' : 'password';
      this.dom.btnToggleTokenMask.textContent = isPass ? '🔒' : '👁️';
    });
    this.dom.btnSaveOtaConfig.addEventListener('click', () => this.saveOtaConfig());

    // Drawer Filter & Search
    this.dom.searchThreads.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value.toLowerCase().trim();
      this.renderConversationList();
    });

    this.dom.filterTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        this.dom.filterTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.activeFilter = btn.dataset.filter;
        this.renderConversationList();
      });
    });

    // New Chat
    this.dom.btnNewChat.addEventListener('click', () => this.openNewChatModal());
    this.dom.btnEmptyNewChat.addEventListener('click', () => this.openNewChatModal());
    this.dom.btnEmptyTriggerBeacon.addEventListener('click', () => this.handleTriggerQuickBeacon());

    // Modal close buttons
    this.dom.btnCloseBeaconModal.addEventListener('click', () => this.dom.modalBeacons.close());
    this.dom.btnCancelBeaconModal.addEventListener('click', () => this.dom.modalBeacons.close());
    this.dom.btnSaveBeaconPref.addEventListener('click', () => this.saveBeaconPreferences());

    this.dom.btnCloseNewChat.addEventListener('click', () => this.dom.modalNewChat.close());
    this.dom.btnCancelNewChat.addEventListener('click', () => this.dom.modalNewChat.close());
    this.dom.formNewChat.addEventListener('submit', (e) => this.handleCreateNewChat(e));

    // Preset pills in New Chat modal
    document.querySelectorAll('.preset-pills .pill-btn').forEach(pill => {
      pill.addEventListener('click', () => {
        this.dom.newRecipient.value = pill.dataset.preset;
      });
    });

    this.dom.btnCloseSettings.addEventListener('click', () => this.dom.modalSettings.close());
    this.dom.btnSaveSettings.addEventListener('click', () => this.dom.modalSettings.close());
    this.dom.formAuth.addEventListener('submit', (e) => this.handleAuthLogin(e));
    this.dom.btnAuthLogout.addEventListener('click', () => this.handleAuthLogout());
    this.dom.btnSaveTarget.addEventListener('click', () => this.handleUpdateServerTarget());

    // Dedicated Login Modal
    this.dom.btnCloseLogin.addEventListener('click', () => this.dom.modalLogin.close());
    this.dom.btnCancelLogin.addEventListener('click', () => this.dom.modalLogin.close());
    this.dom.formModalLogin.addEventListener('submit', (e) => this.handleModalLogin(e));

    this.dom.prefSound.addEventListener('change', (e) => {
      this.state.soundEnabled = e.target.checked;
      localStorage.setItem('gw_pref_sound', e.target.checked);
      this.updateAudioIcon();
    });

    this.dom.prefHaptic.addEventListener('change', (e) => {
      this.state.hapticEnabled = e.target.checked;
      localStorage.setItem('gw_pref_haptic', e.target.checked);
    });

    // Thread View Actions
    this.dom.btnBackToDrawer.addEventListener('click', () => {
      this.dom.drawer.classList.remove('closed');
    });

    this.dom.btnDeleteThread.addEventListener('click', () => this.handleDeleteCurrentThread());

    // Callsign Chip Click inside Message Feed (auto-populate @CALLSIGN into composer)
    this.dom.messageFeed.addEventListener('click', (e) => {
      const chip = e.target.closest('.callsign-chip');
      if (chip && chip.dataset.callsign) {
        this.handleCallsignClick(chip.dataset.callsign);
      }
    });

    // Composer Input Events
    this.dom.inputMessage.addEventListener('input', () => this.updateCharMeter());
    this.dom.inputMessage.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    this.dom.formCompose.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSendMessage();
    });

    // Canned message chip click - accumulates into the chat prompt to build full sentences
    this.dom.cannedScrollList.addEventListener('click', (e) => {
      const chip = e.target.closest('.canned-chip');
      if (!chip) return;
      const text = chip.dataset.text;
      const current = this.dom.inputMessage.value;

      if (!current || current.trim().length === 0) {
        this.dom.inputMessage.value = text;
      } else if (current.endsWith(' ') || current.endsWith('\n')) {
        this.dom.inputMessage.value = current + text;
      } else {
        this.dom.inputMessage.value = current + ' ' + text;
      }

      this.updateCharMeter();
      this.dom.inputMessage.focus();
      const len = this.dom.inputMessage.value.length;
      if (typeof this.dom.inputMessage.setSelectionRange === 'function') {
        this.dom.inputMessage.setSelectionRange(len, len);
      }
    });
  }

  // --- Audio & Haptic Feedback ---
  initAudioContext() {
    this.updateAudioIcon();
    this.dom.prefSound.checked = this.state.soundEnabled;
    this.dom.prefHaptic.checked = this.state.hapticEnabled;
  }

  playChirp(type = 'rx') {
    if (!this.state.soundEnabled) return;

    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const ctx = this.audioCtx;
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'beacon') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'tx') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(2200, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'ack') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(2100, now + 0.1);
        gain2.gain.setValueAtTime(0.25, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.22);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1760, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (err) {
      console.warn('Audio play error:', err);
    }

    if (this.state.hapticEnabled && navigator.vibrate) {
      if (type === 'beacon') navigator.vibrate([100, 50, 100]);
      else if (type === 'tx') navigator.vibrate(60);
      else if (type === 'ack') navigator.vibrate([40, 40, 80]);
      else navigator.vibrate([80, 50, 120]);
    }
  }

  toggleAudio() {
    this.state.soundEnabled = !this.state.soundEnabled;
    localStorage.setItem('gw_pref_sound', this.state.soundEnabled);
    this.dom.prefSound.checked = this.state.soundEnabled;
    this.updateAudioIcon();
    this.showToast(this.state.soundEnabled ? 'Audio Alerts Enabled' : 'Audio Alerts Muted', 'info');
  }

  updateAudioIcon() {
    this.dom.audioIcon.textContent = this.state.soundEnabled ? '🔊' : '🔇';
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  toggleDrawer() {
    this.dom.drawer.classList.toggle('closed');
  }

  // --- Client Discovery & Health Checks ---
  async fetchClientInfo() {
    try {
      const res = await fetch('/client/info');
      if (res.ok) {
        const data = await res.json();
        this.state.targetUrl = data.graywolf_url || 'http://127.0.0.1:8080';
        if (this.dom.diagGwTarget) this.dom.diagGwTarget.textContent = this.state.targetUrl;
        if (this.dom.settingGwTarget) this.dom.settingGwTarget.value = this.state.targetUrl;
        if (this.dom.loginModalTarget) this.dom.loginModalTarget.textContent = this.state.targetUrl;
      }
    } catch (err) {
      console.warn('Failed to fetch client info:', err);
    }
  }

  async checkDaemon() {
    try {
      const res = await fetch('/api/version');
      if (res.ok) {
        const data = await res.json();
        this.state.daemonVersion = data;
        const verStr = `v${data.version || 'unknown'} (${data.platform || 'linux'})`;
        if (this.dom.diagGwVersion) this.dom.diagGwVersion.textContent = verStr;
        this.setConnected(true);
      }
    } catch {
      // Version call failed, server may be unreachable
    }
  }

  // --- API & State Synchronization ---
  async refreshAll() {
    const results = await Promise.allSettled([
      this.fetchStationConfig(),
      this.fetchStatus(),
      this.fetchBeacons(),
      this.fetchConversations()
    ]);

    // Check if any endpoint failed with 401 Unauthorized
    const isUnauthorized = results.some(r => r.status === 'rejected' && r.reason === 401);
    if (isUnauthorized) {
      this.setAuthRequired(true);
    }
  }

  async fetchStationConfig() {
    try {
      const res = await fetch('/api/station/config');
      if (res.status === 401) throw 401;
      if (res.ok) {
        const data = await res.json();
        if (data.callsign) {
          this.state.stationCallsign = data.callsign;
          this.dom.stationCallsign.textContent = data.callsign;
          this.dom.diagGwCallsign.textContent = data.callsign;
          this.dom.summaryStation.textContent = data.callsign;
          this.setAuthRequired(false);
        }
      }
    } catch (err) {
      if (err === 401) throw 401;
      console.warn('Failed to fetch station config:', err);
    }
  }

  async fetchStatus() {
    try {
      const res = await fetch('/api/status');
      if (res.status === 401) {
        this.setAuthRequired(true);
        throw 401;
      }
      if (res.ok) {
        const data = await res.json();
        this.state.status = data;
        this.setConnected(true);
        this.setAuthRequired(false);

        if (this.dom.summaryRx) this.dom.summaryRx.textContent = data.rx_packets ?? 0;
        if (this.dom.summaryTx) this.dom.summaryTx.textContent = data.tx_packets ?? 0;
        if (this.dom.diagGwStatus) this.dom.diagGwStatus.textContent = 'ONLINE (' + (data.status || 'OK') + ')';
        if (this.dom.diagGwUptime) {
          const up = data.uptime_seconds || 0;
          const h = Math.floor(up / 3600);
          const m = Math.floor((up % 3600) / 60);
          this.dom.diagGwUptime.textContent = `${h}h ${m}m`;
        }
      } else {
        this.setConnected(false);
      }
    } catch (err) {
      if (err === 401) throw 401;
      this.setConnected(false);
    }
  }

  async pollStatus() {
    if (this.state.isAuthenticated) {
      await this.fetchStatus().catch(() => {});
      await this.fetchConversations(false).catch(() => {});
    } else {
      await this.checkDaemon();
    }
  }

  setConnected(connected) {
    this.state.isConnected = connected;
    if (!connected) {
      this.dom.connectionDot.className = 'station-dot';
      this.dom.connectionDot.title = 'Disconnected / Daemon Offline';
      if (this.dom.diagGwStatus) this.dom.diagGwStatus.textContent = 'OFFLINE / UNREACHABLE';
    }
  }

  setAuthRequired(required) {
    this.state.isAuthenticated = !required;
    if (required) {
      this.dom.connectionDot.className = 'station-dot auth-required';
      this.dom.connectionDot.title = 'Connected - Authentication Required (Logged Out)';
      this.dom.stationCallsign.textContent = 'LOCKED';
      this.dom.btnLoginPrompt.classList.remove('hidden');
      if (this.dom.diagGwStatus) this.dom.diagGwStatus.textContent = 'CONNECTED (AUTH REQUIRED)';
    } else {
      this.dom.connectionDot.className = 'station-dot online';
      this.dom.connectionDot.title = 'Connected & Authenticated';
      this.dom.btnLoginPrompt.classList.add('hidden');
    }
  }

  // --- Beacons Management & Manual Triggering ---
  async fetchBeacons() {
    try {
      const res = await fetch('/api/beacons');
      if (res.status === 401) throw 401;
      if (res.ok) {
        this.state.beacons = await res.json();
        this.updateQuickBeaconDisplay();
        this.renderBeaconListModal();
      }
    } catch (err) {
      if (err === 401) throw 401;
      console.warn('Failed to fetch beacons:', err);
    }
  }

  updateQuickBeaconDisplay() {
    let activeBeacon = this.state.beacons.find(b => b.id === this.state.quickBeaconId);
    if (!activeBeacon && this.state.beacons.length > 0) {
      activeBeacon = this.state.beacons[0];
      this.state.quickBeaconId = activeBeacon.id;
      localStorage.setItem('gw_quick_beacon_id', activeBeacon.id);
    }

    if (activeBeacon) {
      const label = activeBeacon.comment ? activeBeacon.comment.split(' ')[0] : activeBeacon.callsign;
      this.dom.quickBeaconName.textContent = `${activeBeacon.callsign} (${label})`;
      this.dom.summaryBeacon.textContent = `${activeBeacon.callsign} - ${activeBeacon.interval}s`;
    } else {
      this.dom.quickBeaconName.textContent = 'None';
      this.dom.summaryBeacon.textContent = 'No Beacons Configured';
    }
  }

  renderBeaconListModal() {
    if (!this.dom.beaconListContainer) return;

    if (this.state.beacons.length === 0) {
      this.dom.beaconListContainer.innerHTML = '<div class="empty-state">No beacons configured in Graywolf daemon.</div>';
      return;
    }

    this.dom.beaconListContainer.innerHTML = '';
    this.state.beacons.forEach(beacon => {
      const card = document.createElement('div');
      card.className = `beacon-card ${beacon.id === this.state.quickBeaconId ? 'selected' : ''}`;
      card.dataset.id = beacon.id;

      card.innerHTML = `
        <div class="beacon-card-info">
          <div class="beacon-card-title">
            <span class="beacon-card-call">${this.escapeHtml(beacon.callsign)}</span>
            <span class="beacon-card-desc">Ch: ${beacon.channel || 1} | Every ${beacon.interval}s ${beacon.enabled ? '● Active' : '○ Off'}</span>
          </div>
          <div class="beacon-card-desc">"${this.escapeHtml(beacon.comment || 'No comment')}"</div>
        </div>
        <div class="beacon-card-actions">
          <button class="btn-send-beacon-row" data-id="${beacon.id}">TX NOW</button>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-send-beacon-row')) return;
        this.selectQuickBeacon(beacon.id);
      });

      card.querySelector('.btn-send-beacon-row').addEventListener('click', (e) => {
        e.stopPropagation();
        this.triggerBeacon(beacon.id);
      });

      this.dom.beaconListContainer.appendChild(card);
    });

    this.dom.selectCooldown.value = this.state.cooldownSeconds;
  }

  selectQuickBeacon(beaconId) {
    this.state.quickBeaconId = beaconId;
    this.renderBeaconListModal();
  }

  saveBeaconPreferences() {
    this.state.cooldownSeconds = parseInt(this.dom.selectCooldown.value, 10) || 5;
    localStorage.setItem('gw_beacon_cooldown', this.state.cooldownSeconds);
    localStorage.setItem('gw_quick_beacon_id', this.state.quickBeaconId);
    this.updateQuickBeaconDisplay();
    this.dom.modalBeacons.close();
    this.showToast('Beacon preferences updated', 'success');
  }

  openBeaconModal() {
    if (!this.state.isAuthenticated) {
      this.openLoginModal();
      return;
    }
    this.fetchBeacons();
    this.dom.modalBeacons.showModal();
  }

  // --- Manual Beacon Trigger Action (POST /api/beacons/{id}/send) ---
  async handleTriggerQuickBeacon() {
    if (!this.state.isAuthenticated) {
      this.openLoginModal();
      return;
    }

    if (this.state.cooldownRemaining > 0) {
      this.showToast(`Cooldown active: wait ${this.state.cooldownRemaining}s before re-beaconing`, 'warning');
      return;
    }

    if (!this.state.quickBeaconId) {
      this.openBeaconModal();
      return;
    }

    await this.triggerBeacon(this.state.quickBeaconId);
  }

  async triggerBeacon(beaconId) {
    const beacon = this.state.beacons.find(b => b.id === beaconId);
    const beaconName = beacon ? `${beacon.callsign}` : `Beacon #${beaconId}`;

    // Visual TX feedback
    this.dom.btnTriggerBeacon.classList.add('transmitting');
    setTimeout(() => this.dom.btnTriggerBeacon.classList.remove('transmitting'), 500);
    this.playChirp('beacon');

    try {
      const res = await fetch(`/api/beacons/${beaconId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        this.showToast(`📡 Beacon "${beaconName}" transmitted successfully!`, 'success');
        this.startBeaconCooldown();
        this.fetchStatus().catch(() => {});
      } else {
        const err = await res.json().catch(() => ({}));
        this.showToast(`Beacon failed: ${err.error || 'HTTP ' + res.status}`, 'error');
      }
    } catch (err) {
      this.showToast(`Failed to trigger beacon: ${err.message}`, 'error');
    }
  }

  startBeaconCooldown() {
    this.state.cooldownRemaining = this.state.cooldownSeconds;
    this.dom.btnTriggerBeacon.classList.add('cooldown');
    this.dom.beaconCooldownBadge.classList.remove('hidden');
    this.dom.beaconCooldownBadge.textContent = `${this.state.cooldownRemaining}s`;

    clearInterval(this.state.cooldownTimer);
    this.state.cooldownTimer = setInterval(() => {
      this.state.cooldownRemaining -= 1;
      if (this.state.cooldownRemaining <= 0) {
        clearInterval(this.state.cooldownTimer);
        this.dom.btnTriggerBeacon.classList.remove('cooldown');
        this.dom.beaconCooldownBadge.classList.add('hidden');
      } else {
        this.dom.beaconCooldownBadge.textContent = `${this.state.cooldownRemaining}s`;
      }
    }, 1000);
  }

  // --- Unified Message Reconciliation & State Store ---
  applyMessageChange(change, isLive = true) {
    if (!change) return;

    if (change.kind === 'deleted' || change.kind === 'message.deleted') {
      const delId = change.id || (change.message && change.message.id);
      if (delId) {
        this.state.messages = this.state.messages.filter(m => m.id !== delId);
        this.renderMessages();
      }
      this.fetchConversations(false).catch(() => {});
      return;
    }

    const msg = change.message || (change.thread_key ? change : null);
    if (!msg) return;

    // Reconcile against existing state.messages by server ID, client_id, or msg_id
    const existingIdx = this.state.messages.findIndex(m => {
      if (m.id && msg.id && m.id === msg.id) return true;
      const mClient = m.client_id || m.msg_id;
      const sClient = msg.msg_id || msg.client_id;
      return mClient && sClient && mClient === sClient;
    });

    if (existingIdx >= 0) {
      const old = this.state.messages[existingIdx];
      const oldStatus = (old.status || '').toLowerCase();
      const newStatus = (msg.status || '').toLowerCase();

      this.state.messages[existingIdx] = {
        ...old,
        ...msg,
        client_id: old.client_id || msg.msg_id || msg.client_id
      };
      this.renderMessages();

      // Audio & toast feedback when transition to acked is confirmed (live events only)
      if (isLive && oldStatus !== 'acked' && (newStatus === 'acked' || change.kind === 'message.acked')) {
        this.playChirp('ack');
        this.showToast(`✓ Message ACK received from ${msg.to_call || (this.state.activeThread && this.state.activeThread.key) || 'Station'}`, 'success');
      }
    } else {
      // Determine if incoming message belongs to the active thread
      const activeKey = this.state.activeThread ? this.state.activeThread.key.toUpperCase() : null;
      const msgKey = (msg.thread_key || '').toUpperCase();
      const peerKey = (msg.peer_call || '').toUpperCase();
      const toKey = (msg.to_call || '').toUpperCase();
      const fromKey = (msg.from_call || '').toUpperCase();

      const belongsToActive = activeKey && (
        activeKey === msgKey ||
        activeKey === peerKey ||
        activeKey === toKey ||
        activeKey === fromKey
      );

      if (belongsToActive) {
        this.state.messages.push(msg);
        this.state.messages.sort((a, b) => {
          const ta = Date.parse(a.sent_at || a.received_at || a.created_at || 0) || 0;
          const tb = Date.parse(b.sent_at || b.received_at || b.created_at || 0) || 0;
          return ta - tb;
        });
        this.renderMessages();

        if (isLive && msg.direction === 'in') {
          this.playChirp('rx');
          this.markMessageRead(msg.id);
          this.showToast(`💬 Message from ${msg.from_call}: ${msg.text}`, 'info');
        }
      } else {
        if (isLive && msg.direction === 'in') {
          this.playChirp('rx');
          this.showToast(`💬 APRS from ${msg.from_call}: ${msg.text}`, 'info');
        }
      }
    }

    // Refresh conversation list for updated snippets & unread counts
    this.fetchConversations(false).catch(() => {});
  }

  // --- Real-time SSE Event Stream (/api/messages/events) ---
  connectEventStream() {
    if (!this.state.isAuthenticated) return;

    if (this.eventSource) {
      try { this.eventSource.close(); } catch {}
      this.eventSource = null;
    }

    this.dom.diagSseStatus.textContent = 'Connecting...';

    try {
      this.eventSource = new EventSource('/api/messages/events');

      const handleEvent = (event, evName) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingEvent(data, evName);
        } catch (err) {
          console.warn(`[SSE ${evName}] Parse error:`, err, event.data);
        }
      };

      this.eventSource.onmessage = (e) => handleEvent(e, 'message');

      // Graywolf dispatches named SSE events
      const graywolfEvents = [
        'message.received',
        'message.updated',
        'message.acked',
        'message.deleted',
        'beacon_sent'
      ];
      for (const ev of graywolfEvents) {
        this.eventSource.addEventListener(ev, (e) => handleEvent(e, ev));
      }

      this.eventSource.onopen = () => {
        this.dom.diagSseStatus.textContent = 'CONNECTED (Streaming Live)';
        this.setConnected(true);
      };

      this.eventSource.onerror = () => {
        this.dom.diagSseStatus.textContent = 'Reconnecting...';
      };
    } catch (err) {
      console.warn('SSE connection error:', err);
      this.dom.diagSseStatus.textContent = 'SSE Unavailable';
    }
  }

  handleIncomingEvent(data, eventType) {
    if (data.type === 'beacon_sent' || eventType === 'beacon_sent') {
      this.showToast(`📡 External RF Beacon transmitted (${data.callsign || 'Station'})`, 'info');
      this.fetchStatus().catch(() => {});
      return;
    }

    this.applyMessageChange({
      id: data.id || (data.message && data.message.id),
      kind: data.kind || eventType,
      message: data.message || data
    }, true);
  }

  // --- Graywolf Fast Changelog Polling (mirrors Graywolf's internal sync) ---
  async syncMessagesChangelog() {
    if (!this.state.isAuthenticated) return;

    const isFirstSync = this.state.lastCursor === null;

    try {
      const cursorParam = this.state.lastCursor ? `?cursor=${encodeURIComponent(this.state.lastCursor)}` : '';
      const res = await fetch(`/api/messages${cursorParam}`);
      if (res.status === 401) throw 401;
      if (res.ok) {
        const data = await res.json();
        if (data.cursor) {
          this.state.lastCursor = data.cursor;
        }

        if (Array.isArray(data.changes) && data.changes.length > 0) {
          // Historical messages received during initial cursor establishment do not trigger alerts
          const isLive = !isFirstSync;
          for (const change of data.changes) {
            this.applyMessageChange(change, isLive);
          }
        }
      }
    } catch (err) {
      if (err === 401) {
        this.setAuthRequired(true);
      }
    }
  }

  // --- Conversations Management ---
  async fetchConversations(showLoading = true) {
    try {
      const res = await fetch('/api/messages/conversations?limit=200');
      if (res.status === 401) throw 401;
      if (res.ok) {
        this.state.conversations = await res.json();
        this.renderConversationList();
        this.updateUnreadCounts();
      }
    } catch (err) {
      if (err === 401) throw 401;
      console.warn('Failed to fetch conversations:', err);
      if (showLoading) {
        this.dom.conversationList.innerHTML = '<div class="empty-state">Failed to load conversations.</div>';
      }
    }
  }

  updateUnreadCounts() {
    const total = this.state.conversations.length;
    const unread = this.state.conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

    this.dom.countAll.textContent = total;
    this.dom.countUnread.textContent = unread;
  }

  renderConversationList() {
    const query = this.state.searchQuery;
    const filter = this.state.activeFilter;

    let filtered = this.state.conversations.filter(c => {
      if (filter === 'dm' && c.thread_kind !== 'dm') return false;
      if (filter === 'tactical' && c.thread_kind !== 'tactical') return false;
      if (filter === 'unread' && (!c.unread_count || c.unread_count === 0)) return false;

      if (query) {
        const key = (c.thread_key || '').toLowerCase();
        const alias = (c.alias || '').toLowerCase();
        const snippet = (c.last_snippet || '').toLowerCase();
        return key.includes(query) || alias.includes(query) || snippet.includes(query);
      }
      return true;
    });

    if (filtered.length === 0) {
      this.dom.conversationList.innerHTML = `
        <div class="empty-state">
          ${query ? 'No matching stations.' : (this.state.isAuthenticated ? 'No conversations yet.' : 'Please log in to view conversations.')}
        </div>
      `;
      return;
    }

    this.dom.conversationList.innerHTML = '';
    filtered.forEach(c => {
      const item = document.createElement('div');
      const isActive = this.state.activeThread && this.state.activeThread.key.toUpperCase() === c.thread_key.toUpperCase();
      item.className = `conversation-item ${isActive ? 'active' : ''}`;
      
      const timeStr = c.last_at ? this.formatTime(c.last_at) : '';

      item.innerHTML = `
        <div class="conv-main">
          <div class="conv-top-row">
            <span class="conv-key">${this.escapeHtml(c.thread_key)}</span>
            <span class="conv-kind-badge ${c.thread_kind}">${c.thread_kind}</span>
            ${c.alias ? `<span class="conv-alias">${this.escapeHtml(c.alias)}</span>` : ''}
          </div>
          <div class="conv-snippet">${this.escapeHtml(c.last_snippet || 'No messages')}</div>
        </div>
        <div class="conv-meta">
          <span class="conv-time">${timeStr}</span>
          ${c.unread_count > 0 ? `<span class="conv-badge">${c.unread_count}</span>` : ''}
        </div>
      `;

      item.addEventListener('click', () => {
        this.selectConversation(c);
      });

      this.dom.conversationList.appendChild(item);
    });
  }

  selectConversation(conv) {
    this.state.activeThread = {
      key: conv.thread_key,
      kind: conv.thread_kind || 'dm',
      alias: conv.alias || '',
      participantCount: conv.participant_count || 1
    };

    this.dom.activeThreadKey.textContent = conv.thread_key;
    this.dom.activeThreadKind.textContent = conv.thread_kind.toUpperCase();
    this.dom.activeThreadAlias.textContent = conv.alias || 'Station Peer';
    this.dom.activeThreadParticipants.textContent = conv.thread_kind === 'tactical' 
      ? `${conv.participant_count || 1} stations` 
      : 'Direct Link';

    this.dom.chatEmptyState.classList.add('hidden');
    this.dom.threadPanel.classList.remove('hidden');

    if (window.innerWidth <= 768) {
      this.dom.drawer.classList.add('closed');
    }

    this.renderConversationList();
    this.fetchMessages(conv.thread_kind, conv.thread_key);
    this.dom.inputMessage.focus();
  }

  // --- Messages Feed & Actions ---
  async fetchMessages(kind, key) {
    try {
      const res = await fetch(`/api/messages?thread_kind=${encodeURIComponent(kind)}&thread_key=${encodeURIComponent(key)}&limit=200`);
      if (res.status === 401) throw 401;
      if (res.ok) {
        const data = await res.json();
        const serverMessages = (data.changes || []).map(c => c.message).filter(Boolean);
        serverMessages.sort((a, b) => {
          const ta = Date.parse(a.sent_at || a.received_at || a.created_at || 0) || 0;
          const tb = Date.parse(b.sent_at || b.received_at || b.created_at || 0) || 0;
          return ta - tb;
        });
        this.state.messages = serverMessages;
        this.renderMessages();

        this.state.messages.forEach(m => {
          if (m.unread) this.markMessageRead(m.id);
        });
      }
    } catch (err) {
      if (err === 401) throw 401;
      console.warn('Failed to fetch messages:', err);
    }
  }

  renderMessages() {
    this.dom.messageFeed.innerHTML = '';

    if (this.state.messages.length === 0) {
      this.dom.messageFeed.innerHTML = '<div class="empty-state">No messages in this thread yet. Send a message below.</div>';
      return;
    }

    this.state.messages.forEach(msg => {
      const bubble = document.createElement('div');
      const isOut = msg.direction === 'out';
      bubble.className = `message-bubble ${isOut ? 'out' : 'in'}`;

      const sender = isOut ? (msg.our_call || this.state.stationCallsign) : (msg.from_call || this.state.activeThread.key);
      const timeStr = this.formatTime(msg.sent_at || msg.received_at || msg.created_at);

      let statusBadge = '';
      if (isOut) {
        const status = (msg.status || 'sent').toLowerCase();
        let label = status.toUpperCase();
        if (status === 'acked') label = '✓✓ ACKED';
        else if (status === 'sent') label = '✓ SENT';
        else if (status === 'queued') label = '⏱ QUEUED';
        else if (status === 'pending') label = '⏱ PENDING';
        else if (status === 'failed') label = '⚠ FAILED';

        statusBadge = `<span class="badge-status ${status}">${label}</span>`;
      }

      const extendedBadge = (msg.extended || (msg.text && msg.text.length > 67))
        ? '<span class="badge-extended" title="Message exceeds standard APRS 67 char limit">>67 EXT</span>'
        : '';

      bubble.innerHTML = `
        <span class="bubble-sender">${this.escapeHtml(sender)}</span>
        <span class="bubble-text">${this.formatMessageText(msg.text || '')}</span>
        <div class="bubble-footer">
          ${extendedBadge}
          <span class="bubble-time">${timeStr}</span>
          ${statusBadge}
        </div>
      `;

      this.dom.messageFeed.appendChild(bubble);
    });

    this.dom.messageFeed.scrollTop = this.dom.messageFeed.scrollHeight;
  }

  formatMessageText(rawText) {
    if (!rawText) return '';
    const escaped = this.escapeHtml(rawText);

    // Matches standard amateur radio callsigns with optional leading @ and optional -SSID:
    // 1-2 prefix alphanumeric chars, 1 digit (call area), 1-4 suffix letters, and optional -SSID
    const callsignRegex = /(?:@)?\b([A-Za-z0-9]{1,2}\d[A-Za-z]{1,4}(?:-[A-Za-z0-9]{1,4})?)\b/g;

    return escaped.replace(callsignRegex, (match, fullCall) => {
      const baseCall = fullCall.split('-')[0].toUpperCase();
      return `<button type="button" class="callsign-chip" data-callsign="${baseCall}" title="Tap to populate @${baseCall}">${match}</button>`;
    });
  }

  handleCallsignClick(callsign) {
    if (!callsign) return;
    const baseCall = callsign.split('-')[0].toUpperCase();
    const prefix = `@${baseCall} `;

    let current = this.dom.inputMessage.value.trim();

    if (!current) {
      this.dom.inputMessage.value = prefix;
    } else {
      // If the input already begins with an @CALLSIGN prefix, swap it out
      if (/^@[A-Za-z0-9/-]+\s*/.test(current)) {
        current = current.replace(/^@[A-Za-z0-9/-]+\s*/, '');
      }
      this.dom.inputMessage.value = current.length > 0 ? `${prefix}${current} ` : prefix;
    }

    this.updateCharMeter();
    this.dom.inputMessage.focus();
    const len = this.dom.inputMessage.value.length;
    if (typeof this.dom.inputMessage.setSelectionRange === 'function') {
      this.dom.inputMessage.setSelectionRange(len, len);
    }

    this.playChirp('tx');
    this.showToast(`Set recipient to @${baseCall}`, 'info');
  }

  updateCharMeter() {
    const text = this.dom.inputMessage.value;
    const len = text.length;
    this.dom.charCount.textContent = len;

    this.dom.charMeter.classList.remove('warning', 'danger');
    if (len > 67 && len <= 200) {
      this.dom.charMeter.classList.add('warning');
    } else if (len > 200) {
      this.dom.charMeter.classList.add('danger');
    }
  }

  async handleSendMessage() {
    if (!this.state.isAuthenticated) {
      this.openLoginModal();
      return;
    }

    const text = this.dom.inputMessage.value.trim();
    if (!text || !this.state.activeThread) return;

    const to = this.state.activeThread.key.trim().toUpperCase();
    const preferIs = this.dom.chkPreferIs.checked;
    const path = this.dom.selectPath.value;
    const clientId = `tab-${Date.now()}`;

    const payload = {
      to,
      text,
      path: path || '',
      prefer_is: preferIs,
      kind: 'text',
      client_id: clientId
    };

    this.dom.inputMessage.value = '';
    this.updateCharMeter();
    this.playChirp('tx');

    const optimisticMsg = {
      id: Date.now(),
      client_id: clientId,
      msg_id: clientId,
      thread_key: to,
      thread_kind: this.state.activeThread.kind,
      from_call: this.state.stationCallsign,
      to_call: to,
      direction: 'out',
      text,
      sent_at: new Date().toISOString(),
      status: 'queued',
      attempts: 1,
      extended: text.length > 67
    };
    this.state.messages.push(optimisticMsg);
    this.renderMessages();

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const savedMsg = await res.json();
        const idx = this.state.messages.findIndex(m =>
          m.id === optimisticMsg.id ||
          (m.client_id && (savedMsg.msg_id || savedMsg.client_id) === m.client_id)
        );
        if (idx >= 0) {
          this.state.messages[idx] = {
            ...this.state.messages[idx],
            ...savedMsg,
            client_id: clientId,
            msg_id: savedMsg.msg_id || clientId
          };
          this.renderMessages();
        }
        this.fetchConversations(false).catch(() => {});
        // Trigger immediate changelog sync to catch server progression
        this.syncMessagesChangelog().catch(() => {});
      } else {
        const err = await res.json().catch(() => ({}));
        optimisticMsg.status = 'failed';
        this.renderMessages();
        this.showToast(`Send failed: ${err.error || 'Server error'}`, 'error');
      }
    } catch (err) {
      optimisticMsg.status = 'failed';
      this.renderMessages();
      this.showToast(`Network error: ${err.message}`, 'error');
    }
  }

  async markMessageRead(id) {
    try {
      await fetch(`/api/messages/${id}/read`, { method: 'POST' });
    } catch {}
  }

  async handleDeleteCurrentThread() {
    if (!this.state.activeThread) return;
    const key = this.state.activeThread.key;
    const kind = this.state.activeThread.kind;

    if (!confirm(`Delete entire conversation history for ${key}?`)) return;

    try {
      const res = await fetch(`/api/messages/threads/${encodeURIComponent(kind)}/${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        this.showToast(`Conversation with ${key} deleted`, 'info');
        this.state.activeThread = null;
        this.state.messages = [];
        this.dom.threadPanel.classList.add('hidden');
        this.dom.chatEmptyState.classList.remove('hidden');
        this.fetchConversations();
      }
    } catch (err) {
      this.showToast(`Failed to delete thread: ${err.message}`, 'error');
    }
  }

  // --- New Chat Modal ---
  openNewChatModal() {
    if (!this.state.isAuthenticated) {
      this.openLoginModal();
      return;
    }
    this.dom.newRecipient.value = '';
    this.dom.newMessageText.value = '';
    this.dom.modalNewChat.showModal();
    this.dom.newRecipient.focus();
  }

  handleCreateNewChat(e) {
    e.preventDefault();
    const recipient = this.dom.newRecipient.value.trim().toUpperCase();
    if (!recipient) return;

    const isTactical = recipient.includes('SAR') || recipient.includes('NET') || recipient.includes('ARES');
    const kind = isTactical ? 'tactical' : 'dm';
    const initText = this.dom.newMessageText.value.trim();

    this.dom.modalNewChat.close();

    this.selectConversation({
      thread_key: recipient,
      thread_kind: kind,
      alias: '',
      participant_count: 1
    });

    if (initText) {
      this.dom.inputMessage.value = initText;
      this.handleSendMessage();
    }
  }

  // --- Dedicated Login Modal ---
  openLoginModal() {
    this.dom.loginErrorMsg.classList.add('hidden');
    this.dom.modalLoginPassword.value = '';
    if (this.dom.loginModalTarget) {
      this.dom.loginModalTarget.textContent = this.state.targetUrl;
    }
    this.dom.modalLogin.showModal();
    this.dom.modalLoginUsername.focus();
  }

  async handleModalLogin(e) {
    e.preventDefault();
    const username = this.dom.modalLoginUsername.value.trim();
    const password = this.dom.modalLoginPassword.value;

    this.dom.loginErrorMsg.classList.add('hidden');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        this.dom.modalLogin.close();
        this.setAuthRequired(false);
        this.playChirp('ack');
        this.showToast('✓ Logged in to Graywolf Station!', 'success');
        
        // Refresh all station data, connect SSE stream & run fast changelog sync
        await this.refreshAll();
        this.connectEventStream();
        this.syncMessagesChangelog().catch(() => {});
      } else {
        const err = await res.json().catch(() => ({}));
        this.dom.loginErrorMsg.textContent = err.error || 'Invalid username or password';
        this.dom.loginErrorMsg.classList.remove('hidden');
      }
    } catch (err) {
      this.dom.loginErrorMsg.textContent = `Connection error: ${err.message}`;
      this.dom.loginErrorMsg.classList.remove('hidden');
    }
  }

  // --- Settings & Server Switching ---
  openSettingsModal() {
    this.fetchStatus().catch(() => {});
    this.fetchOtaStatus().catch(() => {});
    this.dom.modalSettings.showModal();
  }

  async handleUpdateServerTarget() {
    const target = this.dom.settingGwTarget.value.trim();
    if (!target) return;

    try {
      const res = await fetch('/client/target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
      });

      if (res.ok) {
        const data = await res.json();
        this.state.targetUrl = data.graywolf_url;
        this.showToast(`Switched target to ${this.state.targetUrl}`, 'info');
        this.dom.modalSettings.close();
        await this.checkDaemon();
        await this.refreshAll();
      } else {
        this.showToast('Failed to update target URL', 'error');
      }
    } catch (err) {
      this.showToast(`Error updating target: ${err.message}`, 'error');
    }
  }

  async handleAuthLogin(e) {
    e.preventDefault();
    const username = this.dom.authUsername.value.trim();
    const password = this.dom.authPassword.value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        this.showToast('Logged in successfully', 'success');
        this.dom.authPassword.value = '';
        this.setAuthRequired(false);
        await this.refreshAll();
        this.connectEventStream();
        this.syncMessagesChangelog().catch(() => {});
      } else {
        const err = await res.json().catch(() => ({}));
        this.showToast(`Login failed: ${err.error || 'Invalid credentials'}`, 'error');
      }
    } catch (err) {
      this.showToast(`Login request error: ${err.message}`, 'error');
    }
  }

  async handleAuthLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      this.showToast('Logged out', 'info');
      this.setAuthRequired(true);
      if (this.eventSource) this.eventSource.close();
    } catch {}
  }

  // --- Utility Helpers ---
  showToast(message, type = 'info') {
    if (!this.dom.toastContainer || !message) return;

    // Deduplicate if identical toast is already active on screen
    const existingToasts = Array.from(this.dom.toastContainer.querySelectorAll('.toast'));
    if (existingToasts.some(t => t.textContent === message)) {
      return;
    }

    // Limit maximum concurrent toasts to 3 on 7" tablet to avoid clutter
    if (existingToasts.length >= 3) {
      existingToasts[0].remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    this.dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s, transform 0.3s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  formatTime(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();

      const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      if (isToday) return time;
      return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
    } catch {
      return '';
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- APRS OTA & Spots Radar Logic ---

  switchDrawerView(view) {
    this.state.activeDrawerView = view;
    if (view === 'spots') {
      this.dom.tabViewChats.classList.remove('active');
      this.dom.tabViewSpots.classList.add('active');
      this.dom.chatsView.classList.add('hidden');
      this.dom.spotsView.classList.remove('hidden');
      this.renderSpots();
    } else {
      this.dom.tabViewSpots.classList.remove('active');
      this.dom.tabViewChats.classList.add('active');
      this.dom.spotsView.classList.add('hidden');
      this.dom.chatsView.classList.remove('hidden');
    }
  }

  handleSpotsIndicatorClick() {
    if (window.innerWidth >= 1200) {
      this.toggleWidescreenRadar();
    } else {
      this.dom.drawer.classList.remove('closed');
      this.switchDrawerView('spots');
    }
  }

  toggleWidescreenRadar(forceState) {
    if (!this.dom.widescreenRadarPanel) return;
    const isHidden = this.dom.widescreenRadarPanel.classList.contains('hidden');
    const shouldOpen = forceState !== undefined ? forceState : isHidden;
    if (shouldOpen) {
      this.dom.widescreenRadarPanel.classList.remove('hidden');
    } else {
      this.dom.widescreenRadarPanel.classList.add('hidden');
    }
    this.state.widescreenRadarOpen = shouldOpen;
    if (shouldOpen) {
      this.renderSpots();
    }
  }

  getActiveBeaconCoords() {
    // Look for selected quick beacon first, or any beacon with valid lat/lon
    const qid = this.state.quickBeaconId;
    const b = this.state.beacons.find(b => b.id === qid && typeof b.latitude === 'number' && typeof b.longitude === 'number' && (b.latitude !== 0 || b.longitude !== 0))
      || this.state.beacons.find(b => typeof b.latitude === 'number' && typeof b.longitude === 'number' && (b.latitude !== 0 || b.longitude !== 0));
    
    if (b) {
      return { lat: b.latitude, lon: b.longitude, name: b.comment || `Beacon ${b.id}` };
    }
    return null;
  }

  calculateDistanceAndBearing(lat1, lon1, lat2, lon2) {
    if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || typeof lat2 !== 'number' || typeof lon2 !== 'number') {
      return null;
    }
    const toRad = d => (d * Math.PI) / 180;
    const toDeg = r => (r * 180) / Math.PI;

    const R_mi = 3958.8; // Earth radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distMi = Math.round(R_mi * c);

    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
              Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    const brng = (toDeg(Math.atan2(y, x)) + 360) % 360;
    const roundedBrng = Math.round(brng);

    const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const cardIdx = Math.round(brng / 22.5) % 16;
    const cardinal = cardinals[cardIdx];

    return { distanceMi: distMi, bearingDeg: roundedBrng, cardinal };
  }

  async fetchOtaStatus() {
    try {
      const res = await fetch('/client/ota-status');
      if (res.ok) {
        const data = await res.json();
        this.state.otaStatus = data;
        if (data.bot_callsign) {
          this.state.botCallsign = data.bot_callsign;
        }

        // Update settings modal display
        if (this.dom.settingOtaBot) {
          this.dom.settingOtaBot.value = this.state.botCallsign;
        }
        if (this.dom.otaStatusDot && this.dom.otaStatusText) {
          if (data.configured) {
            this.dom.otaStatusDot.className = 'station-dot online';
            this.dom.otaStatusText.textContent = `APRS OTA Active (${data.token_preview}) · ${data.spots_count} spots`;
          } else {
            this.dom.otaStatusDot.className = 'station-dot';
            this.dom.otaStatusText.textContent = 'Token Not Set (Using Simulated Mock Spots)';
          }
        }
      }
    } catch (err) {
      console.warn('[OTA STATUS ERROR]', err);
    }
  }

  async saveOtaConfig() {
    const token = this.dom.settingOtaToken ? this.dom.settingOtaToken.value.trim() : '';
    const botCall = this.dom.settingOtaBot ? (this.dom.settingOtaBot.value.trim().toUpperCase() || 'APRSOTA') : 'APRSOTA';

    try {
      const payload = { bot_callsign: botCall };
      if (token) {
        payload.aprsota_token = token;
      }

      const res = await fetch('/client/ota-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        this.showToast('APRS OTA settings saved', 'success');
        if (this.dom.settingOtaToken) this.dom.settingOtaToken.value = '';
        await this.fetchOtaStatus();
        await this.fetchOtaSpots(true);
      } else {
        this.showToast('Failed to save OTA settings', 'error');
      }
    } catch (err) {
      this.showToast(`Error saving settings: ${err.message}`, 'error');
    }
  }

  async fetchOtaSpots(manual = false) {
    try {
      if (manual && this.dom.btnRefreshSpots) {
        this.dom.btnRefreshSpots.classList.add('rotating');
      }

      const res = await fetch('/api/ota/now');
      if (res.ok) {
        const spots = await res.json();
        if (Array.isArray(spots)) {
          this.state.spots = spots;
          this.updateSpotsCounters();
          this.renderSpots();
          if (manual) {
            this.showToast(`Updated ${spots.length} live OTA spots`, 'info');
          }
        }
      }
    } catch (err) {
      console.warn('[FETCH SPOTS ERROR]', err);
      if (manual) {
        this.showToast('Failed to fetch live spots', 'error');
      }
    } finally {
      if (manual && this.dom.btnRefreshSpots) {
        setTimeout(() => this.dom.btnRefreshSpots.classList.remove('rotating'), 500);
      }
    }
  }

  updateSpotsCounters() {
    const total = this.state.spots.length;
    let potaCount = 0;
    let sotaCount = 0;

    this.state.spots.forEach(s => {
      const prog = (s.program || '').toLowerCase();
      if (prog === 'pota') potaCount++;
      else if (prog === 'sota') sotaCount++;
    });

    if (this.dom.spotsTopCount) this.dom.spotsTopCount.textContent = total;
    if (this.dom.spotsTabBadge) this.dom.spotsTabBadge.textContent = total;
    if (this.dom.radarPanelBadge) this.dom.radarPanelBadge.textContent = total;
    if (this.dom.countSpotsAll) this.dom.countSpotsAll.textContent = total;
    if (this.dom.countSpotsPota) this.dom.countSpotsPota.textContent = potaCount;
    if (this.dom.countSpotsSota) this.dom.countSpotsSota.textContent = sotaCount;
  }

  renderSpots() {
    const myCoords = this.getActiveBeaconCoords();
    const filter = this.state.spotFilter;
    const query = this.state.spotSearchQuery;

    // Filter spots
    const filtered = this.state.spots.filter(spot => {
      // Program filter
      const prog = (spot.program || '').toLowerCase();
      if (filter === 'pota' && prog !== 'pota') return false;
      if (filter === 'sota' && prog !== 'sota') return false;

      // Distance calculation
      let distObj = null;
      if (myCoords && typeof spot.latitude === 'number' && typeof spot.longitude === 'number') {
        distObj = this.calculateDistanceAndBearing(myCoords.lat, myCoords.lon, spot.latitude, spot.longitude);
      }
      spot._distObj = distObj;

      if (filter === 'nearby') {
        if (!distObj || distObj.distanceMi > 50) return false;
      }

      // Search query
      if (query) {
        const text = `${spot.callsign} ${spot.name || ''} ${spot.reference || ''} ${spot.grid || ''}`.toLowerCase();
        if (!text.includes(query)) return false;
      }

      return true;
    });

    // Sort: if distance available, sort nearest first, otherwise by most recent last_qso or start
    filtered.sort((a, b) => {
      if (a._distObj && b._distObj) {
        return a._distObj.distanceMi - b._distObj.distanceMi;
      }
      const ta = Date.parse(a.last_qso_at || a.started_at || 0) || 0;
      const tb = Date.parse(b.last_qso_at || b.started_at || 0) || 0;
      return tb - ta;
    });

    const html = filtered.length === 0
      ? `<div class="empty-state-card" style="padding: 24px 16px; text-align: center; color: var(--text-dim);">
           <div style="font-size: 28px; margin-bottom: 8px;">🛰️</div>
           <p style="font-size: 14px; font-weight: 700; color: var(--text-muted);">No Active Spots Found</p>
           <p style="font-size: 12px; margin-top: 4px;">${this.state.spots.length === 0 ? 'Waiting for live activations...' : 'Try selecting another filter tab.'}</p>
         </div>`
      : filtered.map(spot => this.createSpotCardHtml(spot, spot._distObj)).join('');

    if (this.dom.spotsList) {
      this.dom.spotsList.innerHTML = html;
    }
    if (this.dom.radarPanelList) {
      this.dom.radarPanelList.innerHTML = html;
    }
  }

  createSpotCardHtml(spot, distObj) {
    const callsign = this.escapeHtml(spot.callsign || 'N0CALL');
    const prog = (spot.program || 'ota').toUpperCase();
    const badgeClass = prog.toLowerCase() === 'pota' ? 'pota' : (prog.toLowerCase() === 'sota' ? 'sota' : 'pota');
    const ref = this.escapeHtml(spot.reference || '');
    const name = this.escapeHtml(spot.name || 'Activation Site');
    const grid = this.escapeHtml(spot.grid || '');
    const qsos = spot.qsos || 0;
    const points = spot.points || 0;

    let timeAgo = '';
    const lastActivity = spot.last_qso_at || spot.started_at;
    if (lastActivity) {
      const mins = Math.max(0, Math.round((Date.now() - new Date(lastActivity).getTime()) / 60000));
      timeAgo = mins < 1 ? 'just now' : `${mins}m ago`;
    }

    let radarBadgeHtml = '';
    if (distObj) {
      radarBadgeHtml = `
        <span class="spot-radar-tag" title="Distance & Compass Bearing from active beacon">
          <span>📡</span> ${distObj.distanceMi} mi · ${distObj.cardinal} (${distObj.bearingDeg}°)
        </span>
      `;
    } else if (grid) {
      radarBadgeHtml = `<span class="spot-radar-tag">📍 Grid ${grid}</span>`;
    }

    return `
      <div class="spot-card" data-callsign="${callsign}">
        <div class="spot-card-header">
          <div class="spot-call-group">
            <span class="spot-callsign">${callsign}</span>
            <span class="spot-badge ${badgeClass}">${prog} ${ref}</span>
          </div>
          ${timeAgo ? `<span class="spot-time">${timeAgo}</span>` : ''}
        </div>
        <div class="spot-name" title="${name}">${name}</div>
        <div class="spot-meta-row">
          ${radarBadgeHtml}
          <span class="spot-stats">${qsos} QSOs · ${points} pts</span>
        </div>
        <div class="spot-actions-row">
          <button type="button" class="btn-chase" data-callsign="${callsign}">
            <span>⚡</span> <span>1-TAP CHASE</span>
          </button>
        </div>
      </div>
    `;
  }

  handleChase(callsign, spot) {
    const botCall = (this.state.botCallsign || 'APRSOTA').toUpperCase();

    // 1. Locate or create thread with the OTA bot
    let botConv = this.state.conversations.find(c =>
      c.thread_key.toUpperCase() === botCall ||
      c.thread_key.toUpperCase() === 'APRSOTA' ||
      c.thread_key.toUpperCase() === 'OTA'
    );

    if (!botConv) {
      botConv = {
        thread_key: botCall,
        thread_kind: 'dm',
        alias: 'APRS OTA Bot',
        participant_count: 1
      };
      this.state.conversations.unshift(botConv);
    }

    // 2. Select the conversation thread
    this.selectConversation(botConv);

    // 3. Prepopulate message input with @CALLSIGN
    const prefix = `@${callsign.toUpperCase()} `;
    const currentVal = this.dom.inputMessage.value.trim();
    if (!currentVal) {
      this.dom.inputMessage.value = prefix;
    } else if (!currentVal.startsWith(`@${callsign.toUpperCase()}`)) {
      this.dom.inputMessage.value = `${prefix}${currentVal}`;
    }

    this.updateCharMeter();

    // 4. Close drawer on small screens / tablets so message feed & composer are visible
    if (window.innerWidth <= 768) {
      this.dom.drawer.classList.add('closed');
    }

    // 5. Focus input and place cursor at end
    this.dom.inputMessage.focus();
    const len = this.dom.inputMessage.value.length;
    if (typeof this.dom.inputMessage.setSelectionRange === 'function') {
      this.dom.inputMessage.setSelectionRange(len, len);
    }

    this.showToast(`Chasing ${callsign} via ${botCall}`, 'info');
  }
}

// Instantiate and launch client once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new GraywolfClient();
  window.app.init();
});
