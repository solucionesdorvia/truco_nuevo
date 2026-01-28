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
  chipsInterval: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

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
    alert(payload?.message || "Error en la sala");
  });
  socket.on("game:error", (payload) => {
    console.error(payload?.message || "game error");
    alert(payload?.message || "Error en la partida");
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
      button.dataset.playCard ||
      (button.id && button.id.startsWith('btn-'))
    ) {
      return;
    }
    event.preventDefault();
    alert('Próximamente.');
  });
};

const bindSocketOnce = (socket, event, handler) => {
  socket.off(event);
  socket.on(event, handler);
};

const protectRoute = () => {
  const storedToken = localStorage.getItem("truco_token");
  const page = document.body.dataset.page || getPageFromPath();
  if (!storedToken && page !== "landing") {
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
  const closeModal = document.querySelector('[data-action="close-create-modal"]');
  openModal?.addEventListener('click', (event) => {
    event.preventDefault();
    modal?.classList.remove('hidden');
  });
  closeModal?.addEventListener('click', (event) => {
    event.preventDefault();
    modal?.classList.add('hidden');
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
      alert('Ingresá el código de mesa.');
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

const initChips = () => {
  const balanceEl = $('#chip-balance');
  if (!balanceEl) return;
  const refreshBalance = () => {
    apiFetch('/api/chips/balance').then((data) => {
      balanceEl.textContent = data.balance;
    }).catch(() => {
      balanceEl.textContent = '--';
    });
  };
  refreshBalance();
  if (appState.chipsInterval) clearInterval(appState.chipsInterval);
  appState.chipsInterval = setInterval(refreshBalance, 10000);
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

const initStore = () => {
  const buyButtons = $$('[data-buy-amount]');
  const balanceEl = $('#chip-balance');
  const refreshBalance = () => {
    if (!balanceEl) return;
    apiFetch('/api/chips/balance').then((data) => {
      balanceEl.textContent = data.balance;
    }).catch(() => {
      balanceEl.textContent = '--';
    });
  };
  if (balanceEl) {
    refreshBalance();
    if (appState.chipsInterval) clearInterval(appState.chipsInterval);
    appState.chipsInterval = setInterval(refreshBalance, 10000);
  }
  if (!buyButtons.length) return;
  buyButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const amount = Number(btn.getAttribute('data-buy-amount') || 0);
      if (!amount) return;
      btn.setAttribute("disabled", "true");
      btn.classList.add("opacity-70");
      try {
        await apiFetch('/api/chips/add', { method: 'POST', body: JSON.stringify({ amount }) });
        alert('Compra realizada.');
        navigateTo('/fichas');
      } catch (err) {
        alert('No se pudo completar la compra.');
        console.error(err);
      } finally {
        btn.removeAttribute("disabled");
        btn.classList.remove("opacity-70");
      }
    });
  });
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
  if (page === 'lobby') initLobby();
  if (page === 'crear-mesa') initCreateRoom();
  if (page === 'unirse') initJoinRoom();
  if (page === 'mesa') initMesa();
  if (page === 'fichas') initChips();
  if (page === 'tienda') initStore();
  if (page === 'ranking') initRanking();
  scheduleTeardown();
};

document.addEventListener('DOMContentLoaded', () => {
  initPage().catch((err) => console.error(err));
});
