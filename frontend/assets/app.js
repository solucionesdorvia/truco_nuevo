const appState = {
  token: null,
  userId: null,
  username: null,
  socket: null,
  pendingJoin: false,
  pendingCreate: false,
  roomId: null,
  latestRoom: null,
  latestGame: null,
  chipsInterval: null,
  roomsInterval: null,
  toastTimeout: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const formatNumber = (value) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "0";
  return numberValue.toLocaleString("es-AR");
};

const ensureToastContainer = () => {
  let container = $("#toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "fixed top-5 right-5 z-[200] flex flex-col gap-3";
    document.body.appendChild(container);
  }
  return container;
};

const showToast = (message, tone = "info") => {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  const toneClass =
    tone === "success"
      ? "border-primary/40 text-white"
      : tone === "error"
      ? "border-red-500/40 text-white"
      : "border-white/20 text-white/90";
  toast.className = `glass-card border ${toneClass} px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest`;
  toast.textContent = message;
  container.appendChild(toast);
  if (appState.toastTimeout) {
    clearTimeout(appState.toastTimeout);
  }
  appState.toastTimeout = setTimeout(() => {
    toast.remove();
  }, 2800);
};

const apiFetch = async (path, options = {}) => {
  const headers = new Headers(options.headers || {});
  if (appState.token) {
    headers.set("x-user-token", appState.token);
  }
  if (!headers.has("content-type") && options.body) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return response.json();
};

const ensureUser = async () => {
  const storedToken = localStorage.getItem("truco_token");
  const storedUserId = localStorage.getItem("truco_user_id");
  const storedUsername = localStorage.getItem("truco_username");

  if (storedToken && storedUserId) {
    appState.token = storedToken;
    appState.userId = storedUserId;
    appState.username = storedUsername || "Jugador";
    try {
      await apiFetch("/api/users/me");
      return true;
    } catch (_err) {
      localStorage.removeItem("truco_token");
      localStorage.removeItem("truco_user_id");
    }
  }

  const fallbackName = storedUsername || `Jugador${Math.floor(1000 + Math.random() * 9000)}`;
  const payload = { username: fallbackName };
  try {
    const user = await apiFetch("/api/users", { method: "POST", body: JSON.stringify(payload) });
    appState.token = user.token;
    appState.userId = user.id;
    appState.username = user.username;
    localStorage.setItem("truco_token", user.token);
    localStorage.setItem("truco_user_id", user.id);
    localStorage.setItem("truco_username", user.username);
    return true;
  } catch (err) {
    console.error("Failed to create user", err);
    return false;
  }
};

const connectSocket = () => {
  if (appState.socket) return appState.socket;
  const socket = io({ auth: { token: appState.token } });
  socket.on("connect_error", (err) => {
    console.error("socket error", err.message);
  });
  socket.on("rooms:error", (payload) => {
    console.error(payload?.message || "rooms error");
    showToast(payload?.message || "Error en la sala", "error");
  });
  socket.on("game:error", (payload) => {
    console.error(payload?.message || "game error");
    showToast(payload?.message || "Error en la partida", "error");
  });
  appState.socket = socket;
  return socket;
};

const disconnectSocket = () => {
  if (!appState.socket) return;
  appState.socket.removeAllListeners();
  appState.socket.disconnect();
  appState.socket = null;
};

const scheduleTeardown = () => {
  window.addEventListener("beforeunload", () => {
    if (appState.roomId && appState.socket) {
      appState.socket.emit("rooms:leave", { roomId: appState.roomId });
    }
    if (appState.chipsInterval) {
      clearInterval(appState.chipsInterval);
    }
    if (appState.roomsInterval) {
      clearInterval(appState.roomsInterval);
    }
    disconnectSocket();
  });
};

const navigateTo = (path) => {
  window.location.href = path;
};

const bindNavButtons = () => {
  $$('[data-nav]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      const target = el.getAttribute('data-nav');
      if (target) navigateTo(target);
    });
  });
};

const bindFallbackButtons = () => {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (
      button.dataset.nav ||
      button.dataset.action ||
      button.dataset.joinRoom ||
      button.dataset.buyAmount ||
      button.dataset.paymentMethod ||
      button.dataset.playCard ||
      (button.id && button.id.startsWith('btn-'))
    ) {
      return;
    }
    event.preventDefault();
    showToast('Próximamente.', "info");
  });
};

const bindSocketOnce = (socket, event, handler) => {
  socket.off(event);
  socket.on(event, handler);
};

const protectRoute = () => {
  const storedToken = localStorage.getItem("truco_token");
  const page = document.body.dataset.page || getPageFromPath();
  const publicPages = new Set(["landing", "faq", "privacidad", "terminos", "soporte"]);
  if (!storedToken && !publicPages.has(page)) {
    navigateTo("/landing");
    return false;
  }
  return true;
};

const formatRoomMode = (room) => `${room.mode} · ${room.points} pts`;

const renderRooms = (rooms) => {
  const container = $("#rooms-list");
  if (!container) return;
  if (!Array.isArray(rooms) || !rooms.length) {
    container.innerHTML = '<div class="glass-card rounded-2xl p-6 text-white/60">No hay mesas disponibles.</div>';
    return;
  }

  container.innerHTML = rooms.map((room) => {
    const isPrivate = room.privacy === "private";
    const teamSize = room.mode === "1v1" ? 1 : room.mode === "2v2" ? 2 : 3;
    const countA = room.members.filter((m) => m.team === "A").length;
    const countB = room.members.filter((m) => m.team === "B").length;
    const statusLabel =
      room.status === "playing"
        ? "Jugando"
        : room.status === "finished"
        ? "Finalizada"
        : "Esperando";
    const statusClass =
      room.status === "playing"
        ? "text-red-400 border-red-500/30 bg-red-500/10"
        : room.status === "finished"
        ? "text-white/40 border-white/10 bg-white/5"
        : "text-primary border-primary/30 bg-primary/10";
    return `
      <div class="glass-card flex flex-col rounded-2xl overflow-hidden transition-all group">
        <div class="p-6 flex flex-col gap-5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="size-9 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
                <span class="material-symbols-outlined text-gold text-xl">person</span>
              </div>
              <span class="font-display font-bold text-white/90">${room.name ?? "Mesa Premium"}</span>
            </div>
            <div class="flex gap-2">
              <span class="rounded bg-black/40 text-gold text-[10px] font-black px-2.5 py-1 border border-gold/40 uppercase tracking-tighter">${formatRoomMode(room)}</span>
              <span class="rounded text-[10px] font-black px-2.5 py-1 border uppercase tracking-tighter ${statusClass}">${statusLabel}</span>
              ${isPrivate ? '<span class="rounded bg-red-500/10 text-red-400 text-[10px] font-black px-2.5 py-1 border border-red-500/20 uppercase">Privada 🔒</span>' : ''}
            </div>
          </div>
          <div class="flex items-center justify-between border-y border-white/5 py-4">
            <div class="flex flex-col">
              <span class="text-[10px] uppercase font-bold text-white/40 tracking-[0.15em]">Entrada</span>
              <span class="text-xl font-bold text-gold">$${room.entryFee}</span>
            </div>
            <div class="flex flex-col items-end">
              <span class="text-[10px] uppercase font-bold text-white/40 tracking-[0.15em]">Pozo Total</span>
              <span class="text-xl font-bold text-gold gold-glow">$${room.potTotal}</span>
            </div>
          </div>
          <div class="flex flex-col gap-3">
            <div class="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/50 px-1">
              <span>Cupos</span>
              <span class="text-primary">A ${countA}/${teamSize} · B ${countB}/${teamSize}</span>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <button data-join-room="${room.id}" data-join-team="A" class="tap-target flex items-center justify-center rounded-xl border border-primary/30 bg-primary/5 text-primary hover:bg-primary/20 transition-all font-bold text-xs uppercase tracking-widest">
                Equipo A
              </button>
              <button data-join-room="${room.id}" data-join-team="B" class="tap-target flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 transition-all font-bold text-xs uppercase tracking-widest">
                Equipo B
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  $$('[data-join-room]').forEach((button) => {
    button.addEventListener('click', () => {
      const roomId = button.getAttribute('data-join-room');
      const team = button.getAttribute('data-join-team');
      if (!roomId) return;
      const socket = connectSocket();
      appState.pendingJoin = true;
      socket.emit('rooms:join', { roomId, team });
    });
  });
};

const bindCreateRoom = (root = document) => {
  const createButton = root.querySelector('[data-action="create-room"]');
  if (!createButton) return;
  const socket = connectSocket();

  createButton.addEventListener('click', () => {
    const privacy = root.querySelector('input[name="privacy"]:checked')?.value || 'public';
    const mode = root.querySelector('input[name="mode"]:checked')?.value || '1v1';
    const points = Number(root.querySelector('input[name="points"]:checked')?.value || 15);
    const economy = root.querySelector('input[name="economy"]:checked')?.value || 'free';
    const entryFeeValue = Number(root.querySelector('input[name="entryFee"]')?.value || 0);
    const allowFlor = Boolean(root.querySelector('input[name="allowFlor"]')?.checked);
    const config = {
      privacy,
      mode,
      points,
      economy,
      entryFee: economy === 'paid' ? entryFeeValue : 0,
      allowFlor
    };
    appState.pendingCreate = true;
    socket.emit('rooms:create', { config });
  });

  bindSocketOnce(socket, 'room:state', (room) => {
    appState.latestRoom = room;
    if (appState.pendingCreate) {
      appState.pendingCreate = false;
      navigateTo(`/mesa/${room.id}`);
    }
  });
};

const initLobby = () => {
  const socket = connectSocket();
  socket.emit('rooms:list');
  bindSocketOnce(socket, 'rooms:list', renderRooms);
  bindSocketOnce(socket, 'rooms:update', renderRooms);
  const refresh = document.querySelector('[data-action="refresh-rooms"]');
  refresh?.addEventListener('click', () => socket.emit('rooms:list'));
  const modal = document.querySelector('#create-modal');
  const openModal = document.querySelector('[data-action="open-create-modal"]');
  const closeButtons = $$('[data-action="close-create-modal"]');
  const setModalOpen = (isOpen) => {
    if (!modal) return;
    modal.classList.toggle('hidden', !isOpen);
    document.body.classList.toggle('overflow-hidden', isOpen);
  };
  openModal?.addEventListener('click', (event) => {
    event.preventDefault();
    setModalOpen(true);
  });
  closeButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      setModalOpen(false);
    });
  });
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) {
      setModalOpen(false);
    }
  });
  if (modal) {
    bindCreateRoom(modal);
  }
  bindSocketOnce(socket, 'room:state', (room) => {
    appState.latestRoom = room;
    if (appState.pendingJoin) {
      appState.pendingJoin = false;
      navigateTo(`/mesa/${room.id}`);
    }
  });
  socket.off('connect');
  socket.on('connect', () => socket.emit('rooms:list'));
};

const initCreateRoom = () => {
  bindCreateRoom(document);
};

const initJoinRoom = () => {
  const socket = connectSocket();
  const joinButton = $('[data-action="join-room"]');
  const codeInputs = $$('[data-code-input]');

  const readCode = () => {
    if (codeInputs.length) {
      return codeInputs.map((input) => input.value).join("").trim();
    }
    return ($('#join-code')?.value || "").trim();
  };

  joinButton?.addEventListener('click', () => {
    const code = readCode();
    if (!code) {
      showToast('Ingresá el código de mesa.', "info");
      return;
    }
    appState.pendingJoin = true;
    socket.emit('rooms:join', { code });
  });

  bindSocketOnce(socket, 'room:state', (room) => {
    appState.latestRoom = room;
    if (appState.pendingJoin) {
      appState.pendingJoin = false;
      navigateTo(`/mesa/${room.id}`);
    }
  });
  socket.off('connect');
  socket.on('connect', () => {
    const code = readCode();
    if (code) socket.emit('rooms:join', { code });
  });
};

const renderGame = (state) => {
  appState.latestGame = state;
  const scoreA = $('#score-a');
  const scoreB = $('#score-b');
  if (scoreA) scoreA.textContent = state.teams.A.score;
  if (scoreB) scoreB.textContent = state.teams.B.score;

  const pending = $('#pending-call');
  if (pending) {
    if (state.pendingTruco) {
      pending.textContent = `Truco pendiente (${state.pendingTruco.level}) - responde equipo ${state.pendingTruco.respondBy}`;
    } else if (state.pendingEnvido) {
      pending.textContent = `Envido pendiente (${state.pendingEnvido.level}) - responde equipo ${state.pendingEnvido.respondBy}`;
    } else {
      pending.textContent = '';
    }
  }

  const myPlayer = state.players.find((p) => p.userId === appState.userId);
  const handContainer = $('#hand-cards');
  if (handContainer && myPlayer) {
    handContainer.innerHTML = myPlayer.hand.map((card) => {
      return `
        <button data-play-card='${JSON.stringify(card)}' class="glass-card rounded-xl px-4 py-6 text-center hover:scale-105 transition-transform">
          <div class="text-2xl font-black text-gold">${card.rank}</div>
          <div class="text-xs uppercase text-white/60 mt-1">${card.suit}</div>
        </button>
      `;
    }).join('');
    $$('[data-play-card]').forEach((button) => {
      button.addEventListener('click', () => {
        const payload = JSON.parse(button.getAttribute('data-play-card'));
        const socket = connectSocket();
        socket.emit('game:action', { roomId: appState.roomId, action: { type: 'play_card', userId: appState.userId, card: payload } });
      });
    });
  }

  const table = $('#table-cards');
  if (table) {
    table.innerHTML = state.table.map((play) => {
      return `
        <div class="glass-card rounded-xl px-4 py-3 text-center">
          <div class="text-xs text-white/50">${play.team}</div>
          <div class="text-lg font-bold text-gold">${play.card.rank}</div>
          <div class="text-[10px] uppercase text-white/60">${play.card.suit}</div>
        </div>
      `;
    }).join('');
  }

  const turn = $('#turn-indicator');
  if (turn && myPlayer) {
    turn.textContent = myPlayer.seat === state.currentTurnSeat ? 'Tu turno' : 'Turno rival';
  }

  const status = $('#game-status');
  if (status && state.phase === 'game_end') {
    const winner = state.teams.A.score > state.teams.B.score ? 'Equipo A' : 'Equipo B';
    status.textContent = `Partida finalizada. Ganó ${winner}.`;
  }
};

const initMesa = () => {
  const pathParts = window.location.pathname.split('/');
  const roomId = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];
  appState.roomId = roomId;
  const socket = connectSocket();
  socket.on("connect", () => {
    if (appState.roomId) {
      socket.emit("rooms:join", { roomId: appState.roomId });
    }
  });
  socket.emit('rooms:join', { roomId });
  bindSocketOnce(socket, 'room:state', (room) => {
    appState.latestRoom = room;
    const roomIdEl = $('#room-id');
    if (roomIdEl) {
      roomIdEl.textContent = room.id;
    }
  });
  bindSocketOnce(socket, 'game:state', renderGame);

  $('#btn-truco')?.addEventListener('click', () => {
    socket.emit('game:action', { roomId, action: { type: 'call_truco', userId: appState.userId } });
  });
  $('#btn-envido')?.addEventListener('click', () => {
    socket.emit('game:action', { roomId, action: { type: 'call_envido', userId: appState.userId, level: 'envido' } });
  });
  $('#btn-retruco')?.addEventListener('click', () => {
    socket.emit('game:action', { roomId, action: { type: 'call_truco', userId: appState.userId } });
  });
  $('#btn-vale4')?.addEventListener('click', () => {
    socket.emit('game:action', { roomId, action: { type: 'call_truco', userId: appState.userId } });
  });
  $('#btn-fold')?.addEventListener('click', () => {
    socket.emit('game:action', { roomId, action: { type: 'fold', userId: appState.userId } });
  });
  $('#btn-accept')?.addEventListener('click', () => {
    if (appState.latestGame?.pendingTruco) {
      socket.emit('game:action', { roomId, action: { type: 'respond_truco', userId: appState.userId, accept: true } });
      return;
    }
    if (appState.latestGame?.pendingEnvido) {
      socket.emit('game:action', { roomId, action: { type: 'respond_envido', userId: appState.userId, accept: true } });
    }
  });
  $('#btn-reject')?.addEventListener('click', () => {
    if (appState.latestGame?.pendingTruco) {
      socket.emit('game:action', { roomId, action: { type: 'respond_truco', userId: appState.userId, accept: false } });
      return;
    }
    if (appState.latestGame?.pendingEnvido) {
      socket.emit('game:action', { roomId, action: { type: 'respond_envido', userId: appState.userId, accept: false } });
    }
  });

  const leaveLink = document.querySelector('a[href="/lobby"]');
  leaveLink?.addEventListener('click', () => {
    socket.emit('rooms:leave', { roomId });
  });
};

const renderChipHistory = (rows) => {
  const historyEl = $('#chip-history');
  if (!historyEl) return;
  if (!Array.isArray(rows) || rows.length === 0) {
    historyEl.innerHTML = '<div class="text-white/40 text-xs uppercase tracking-widest">Sin movimientos recientes.</div>';
    return;
  }
  historyEl.innerHTML = rows.map((row) => {
    const amount = Number(row.amount);
    const isPositive = amount >= 0;
    const sign = isPositive ? "+" : "−";
    const reasonMap = {
      store_purchase: "Compra",
      room_entry: "Entrada",
      room_payout: "Premio"
    };
    const reason = reasonMap[row.reason] ?? row.reason?.replace(/_/g, " ") ?? "movimiento";
    const date = row.createdAt ? new Date(row.createdAt).toLocaleString("es-AR") : "";
    return `
      <div class="flex items-center justify-between border-b border-white/5 py-3">
        <div class="flex flex-col">
          <span class="text-xs font-bold uppercase tracking-widest text-white/80">${reason}</span>
          <span class="text-[10px] text-white/40">${date}</span>
        </div>
        <span class="text-sm font-black ${isPositive ? "text-primary" : "text-red-400"}">${sign}${formatNumber(Math.abs(amount))}</span>
      </div>
    `;
  }).join("");
};

const initCajero = () => {
  const balanceEl = $('#chip-balance');
  const historyEl = $('#chip-history');
  const refreshBalance = () => {
    if (!balanceEl) return;
    balanceEl.classList.add("animate-pulse");
    apiFetch('/api/chips/balance').then((data) => {
      balanceEl.textContent = formatNumber(data.balance);
    }).catch(() => {
      balanceEl.textContent = '0';
    }).finally(() => {
      balanceEl.classList.remove("animate-pulse");
    });
  };
  const refreshHistory = () => {
    if (!historyEl) return;
    historyEl.innerHTML = '<div class="text-white/40 text-xs uppercase tracking-widest">Cargando movimientos...</div>';
    apiFetch('/api/chips/history?limit=12').then((rows) => {
      renderChipHistory(rows);
    }).catch(() => {
      historyEl.innerHTML = '<div class="text-white/40 text-xs uppercase tracking-widest">No se pudo cargar el historial.</div>';
    });
  };
  refreshBalance();
  refreshHistory();
  if (appState.chipsInterval) clearInterval(appState.chipsInterval);
  appState.chipsInterval = setInterval(() => {
    refreshBalance();
    refreshHistory();
  }, 15000);

  const buyButtons = $$('[data-buy-amount]');
  const checkoutModal = $('#checkout-modal');
  const checkoutName = $('#checkout-pack-name');
  const checkoutChips = $('#checkout-pack-chips');
  const checkoutPrice = $('#checkout-pack-price');
  const payButton = $('#checkout-pay');
  const methodButtons = $$('[data-payment-method]');
  const closeButtons = $$('[data-action="close-checkout"]');
  let selectedAmount = 0;
  let selectedMethod = null;

  const setCheckoutOpen = (isOpen) => {
    if (!checkoutModal) return;
    checkoutModal.classList.toggle('hidden', !isOpen);
    document.body.classList.toggle('overflow-hidden', isOpen);
  };

  buyButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const amount = Number(btn.getAttribute('data-buy-amount') || 0);
      const packName = btn.getAttribute('data-pack-name') || 'Pack de fichas';
      const packPrice = btn.getAttribute('data-pack-price') || '';
      if (!amount) return;
      selectedAmount = amount;
      selectedMethod = null;
      if (checkoutName) checkoutName.textContent = packName;
      if (checkoutChips) checkoutChips.textContent = `${formatNumber(amount)} fichas`;
      if (checkoutPrice) checkoutPrice.textContent = packPrice;
      methodButtons.forEach((method) => {
        method.classList.remove('border-gold/50', 'bg-gold/5');
      });
      if (payButton) {
        payButton.setAttribute('disabled', 'true');
        payButton.classList.add('opacity-50', 'cursor-not-allowed');
      }
      setCheckoutOpen(true);
    });
  });

  closeButtons.forEach((btn) => {
    btn.addEventListener('click', () => setCheckoutOpen(false));
  });
  checkoutModal?.addEventListener('click', (event) => {
    if (event.target === checkoutModal) {
      setCheckoutOpen(false);
    }
  });

  methodButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.getAttribute('data-payment-disabled') === 'true') return;
      selectedMethod = button.getAttribute('data-payment-method');
      methodButtons.forEach((method) => {
        method.classList.remove('border-gold/50', 'bg-gold/5');
      });
      button.classList.add('border-gold/50', 'bg-gold/5');
      if (payButton) {
        payButton.removeAttribute('disabled');
        payButton.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    });
  });

  payButton?.addEventListener('click', async () => {
    if (!selectedAmount || !selectedMethod) return;
    payButton.setAttribute('disabled', 'true');
    payButton.classList.add('opacity-50', 'cursor-not-allowed');
    try {
      await apiFetch('/api/chips/add', { method: 'POST', body: JSON.stringify({ amount: selectedAmount }) });
      showToast("Compra confirmada", "success");
      setCheckoutOpen(false);
      refreshBalance();
      refreshHistory();
    } catch (err) {
      console.error(err);
      showToast("Error al procesar el pago", "error");
    } finally {
      payButton.removeAttribute('disabled');
      payButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  });
};

const initRanking = () => {
  const list = $('#ranking-list');
  if (!list) return;
  apiFetch('/api/ranking').then((rows) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      list.innerHTML = '<div class="text-white/50">No hay ranking disponible.</div>';
      return;
    }
    list.innerHTML = rows.map((row, index) => {
      return `
        <div class="flex items-center justify-between border-b border-white/5 py-3">
          <div class="flex items-center gap-3">
            <span class="text-gold font-black">#${index + 1}</span>
            <span class="font-bold text-white">${row.username ?? row.userId}</span>
          </div>
          <div class="text-white/60 text-sm">${row.points} pts · ${row.wins}W ${row.losses}L</div>
        </div>
      `;
    }).join('');
  }).catch(() => {
    list.innerHTML = '<div class="text-white/50">No hay ranking disponible.</div>';
  });
};

const initLanding = () => {
  const balanceEl = $('#landing-chip-balance');
  const roomsCountEl = $('#rooms-count');
  const roomsLabelEl = $('#rooms-label');
  const refreshLanding = () => {
    if (roomsCountEl) {
      roomsCountEl.textContent = "—";
      apiFetch('/api/rooms').then((rooms) => {
        const count = Array.isArray(rooms) ? rooms.length : 0;
        roomsCountEl.textContent = formatNumber(count);
        if (roomsLabelEl) {
          roomsLabelEl.textContent = count === 1 ? "mesa activa" : "mesas activas";
        }
      }).catch(() => {
        roomsCountEl.textContent = "0";
      });
    }
    if (balanceEl && appState.token) {
      apiFetch('/api/chips/balance').then((data) => {
        balanceEl.textContent = formatNumber(data.balance);
      }).catch(() => {
        balanceEl.textContent = "0";
      });
    }
  };
  refreshLanding();
  if (appState.roomsInterval) clearInterval(appState.roomsInterval);
  appState.roomsInterval = setInterval(refreshLanding, 15000);
};

const getPageFromPath = () => {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "" || path === "/") return "landing";
  if (path.startsWith("/mesa/")) return "mesa";
  return path.slice(1);
};

const initPage = async () => {
  const page = document.body.dataset.page || getPageFromPath();
  const needsAuth = page !== "landing";
  if (needsAuth && !protectRoute()) {
    return;
  }
  const ok = await ensureUser();
  if (!ok && needsAuth) {
    navigateTo("/landing");
    return;
  }
  bindNavButtons();
  bindFallbackButtons();
  if (page === 'landing') initLanding();
  if (page === 'lobby') initLobby();
  if (page === 'crear-mesa') initCreateRoom();
  if (page === 'unirse') initJoinRoom();
  if (page === 'mesa') initMesa();
  if (page === 'fichas' || page === 'tienda') initCajero();
  if (page === 'ranking') initRanking();
  scheduleTeardown();
};

document.addEventListener('DOMContentLoaded', () => {
  initPage().catch((err) => console.error(err));
});
