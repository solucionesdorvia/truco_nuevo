import { v4 as uuid } from "uuid";
import { buildDeck, shuffleDeck } from "./deck";
import { getEnvidoCardValue, getTrucoPower } from "./scoring";
import { GameAction, GameState, PlayerState, TrickPlay } from "./types";
import { validateAction } from "./validations";
import { TeamId } from "../rooms/roomTypes";

const dealHands = (players: PlayerState[], deck: ReturnType<typeof buildDeck>) => {
  const nextDeck = [...deck];
  const updated = players.map((player) => ({ ...player, hand: [] as typeof player.hand }));

  for (let i = 0; i < 3; i += 1) {
    for (const player of updated) {
      const card = nextDeck.shift();
      if (!card) break;
      player.hand.push(card);
    }
  }

  return { players: updated, deck: nextDeck };
};

const getOpponentTeam = (team: TeamId): TeamId => (team === "A" ? "B" : "A");

const resolveTrickWinner = (
  plays: TrickPlay[],
  trickLeaderSeat: number
): { winnerTeam: TeamId; winnerSeat: number } => {
  let best = plays[0];
  let tie = false;

  for (let i = 1; i < plays.length; i += 1) {
    const challenger = plays[i];
    const bestPower = getTrucoPower(best.card);
    const challengerPower = getTrucoPower(challenger.card);

    if (challengerPower > bestPower) {
      best = challenger;
      tie = false;
      continue;
    }

    if (challengerPower === bestPower) {
      tie = true;
    }
  }

  if (tie) {
    const leader = plays.find((play) => play.seat === trickLeaderSeat) ?? plays[0];
    return { winnerTeam: leader.team, winnerSeat: leader.seat };
  }

  return { winnerTeam: best.team, winnerSeat: best.seat };
};

const calculateEnvidoPoints = (hand: PlayerState["hand"]): number => {
  if (hand.length === 0) return 0;

  const bySuit = new Map<string, number[]>();
  for (const card of hand) {
    const value = getEnvidoCardValue(card);
    const list = bySuit.get(card.suit) ?? [];
    list.push(value);
    bySuit.set(card.suit, list);
  }

  let best = 0;
  for (const values of bySuit.values()) {
    values.sort((a, b) => b - a);
    if (values.length >= 2) {
      best = Math.max(best, values[0] + values[1] + 20);
    } else {
      best = Math.max(best, values[0]);
    }
  }

  return best;
};

const getTeamEnvido = (state: GameState, team: TeamId): number => {
  const teamPlayers = state.players.filter((player) => player.team === team);
  return teamPlayers.reduce((best, player) => {
    const score = calculateEnvidoPoints(player.hand);
    return Math.max(best, score);
  }, 0);
};

const awardPoints = (state: GameState, team: TeamId, points: number) => {
  state.teams[team].score += points;
};

const endHand = (state: GameState, winnerTeam: TeamId) => {
  awardPoints(state, winnerTeam, state.trucoLevel);
  state.lastHandWinner = winnerTeam;
  state.phase = state.teams[winnerTeam].score >= state.targetScore ? "game_end" : "hand_end";
};

const startNextHand = (state: GameState) => {
  if (state.phase === "game_end") return;

  state.handNumber += 1;
  state.trickNumber = 1;
  state.table = [];
  state.tricksWon = { A: 0, B: 0 };
  state.trucoLevel = 1;
  state.pendingTruco = undefined;
  state.pendingEnvido = undefined;
  state.envidoResolved = false;
  state.manoSeat = (state.manoSeat + 1) % state.players.length;
  state.currentTurnSeat = state.manoSeat;
  state.trickLeaderSeat = state.manoSeat;

  const shuffledDeck = shuffleDeck(buildDeck());
  const { players, deck } = dealHands(state.players, shuffledDeck);
  state.players = players;
  state.deck = deck;
  state.phase = "playing";
};

export const createInitialGameState = (params: {
  roomId: string;
  players: { userId: string; seat: number; team: TeamId }[];
  targetScore: 15 | 30;
}): GameState => {
  const shuffledDeck = shuffleDeck(buildDeck());
  const playerStates: PlayerState[] = params.players.map((player, index) => ({
    userId: player.userId,
    seat: player.seat,
    team: player.team,
    hand: [],
    isDealer: index === params.players.length - 1
  }));

  const { players, deck } = dealHands(playerStates, shuffledDeck);

  return {
    id: uuid(),
    roomId: params.roomId,
    phase: "playing",
    deck,
    table: [],
    currentTurnSeat: 0,
    trickLeaderSeat: 0,
    trickNumber: 1,
    players,
    teams: {
      A: { id: "A", score: 0 },
      B: { id: "B", score: 0 }
    },
    tricksWon: { A: 0, B: 0 },
    targetScore: params.targetScore,
    handNumber: 1,
    manoSeat: 0,
    trucoLevel: 1,
    envidoResolved: false
  };
};

export const applyAction = (
  state: GameState,
  action: GameAction
): { state: GameState; error?: string } => {
  const error = validateAction(state, action);
  if (error) {
    return { state, error };
  }

  const player = state.players.find((p) => p.userId === action.userId)!;

  if (action.type === "call_truco") {
    if (state.trucoLevel >= 4) {
      return { state, error: "Truco already at max" };
    }

    const level = (state.trucoLevel + 1) as 2 | 3 | 4;
    state.pendingTruco = {
      level,
      calledBy: player.team,
      respondBy: getOpponentTeam(player.team)
    };
    return { state };
  }

  if (action.type === "respond_truco") {
    if (!state.pendingTruco) {
      return { state, error: "No truco to respond" };
    }

    if (player.team !== state.pendingTruco.respondBy) {
      return { state, error: "Not your team to respond" };
    }

    if (!action.accept) {
      const winner = state.pendingTruco.calledBy;
      awardPoints(state, winner, state.trucoLevel);
      state.pendingTruco = undefined;
      endHand(state, winner);
      startNextHand(state);
      return { state };
    }

    state.trucoLevel = state.pendingTruco.level;
    state.pendingTruco = undefined;
    return { state };
  }

  if (action.type === "call_envido") {
    if (state.pendingEnvido) {
      return { state, error: "Envido already pending" };
    }

    state.pendingEnvido = {
      level: action.level,
      calledBy: player.team,
      respondBy: getOpponentTeam(player.team)
    };
    return { state };
  }

  if (action.type === "respond_envido") {
    if (!state.pendingEnvido) {
      return { state, error: "No envido to respond" };
    }

    if (player.team !== state.pendingEnvido.respondBy) {
      return { state, error: "Not your team to respond" };
    }

    const calledBy = state.pendingEnvido.calledBy;
    const opponent = getOpponentTeam(calledBy);

    if (!action.accept) {
      awardPoints(state, calledBy, 1);
      state.pendingEnvido = undefined;
      state.envidoResolved = true;
      return { state };
    }

    const teamA = getTeamEnvido(state, "A");
    const teamB = getTeamEnvido(state, "B");
    let envidoWinner: TeamId = teamA === teamB
      ? state.players.find((p) => p.seat === state.manoSeat)!.team
      : teamA > teamB
        ? "A"
        : "B";

    let points = 0;
    if (state.pendingEnvido.level === "envido") points = 2;
    if (state.pendingEnvido.level === "real_envido") points = 3;
    if (state.pendingEnvido.level === "falta_envido") {
      const opponentScore = state.teams[getOpponentTeam(envidoWinner)].score;
      points = state.targetScore - opponentScore;
    }

    awardPoints(state, envidoWinner, points);
    state.pendingEnvido = undefined;
    state.envidoResolved = true;
    return { state };
  }

  if (action.type === "fold") {
    const winner = getOpponentTeam(player.team);
    awardPoints(state, winner, state.trucoLevel);
    endHand(state, winner);
    startNextHand(state);
    return { state };
  }

  if (action.type === "play_card") {
    player.hand = player.hand.filter(
      (card) => !(card.rank === action.card.rank && card.suit === action.card.suit)
    );

    state.table.push({
      userId: player.userId,
      team: player.team,
      seat: player.seat,
      card: action.card
    });

    const nextSeat = (state.currentTurnSeat + 1) % state.players.length;
    state.currentTurnSeat = nextSeat;

    if (state.table.length >= state.players.length) {
      const result = resolveTrickWinner(state.table, state.trickLeaderSeat);
      state.lastTrickWinner = result.winnerTeam;
      state.tricksWon[result.winnerTeam] += 1;

      state.table = [];
      state.trickNumber = (state.trickNumber + 1) as 1 | 2 | 3;
      state.currentTurnSeat = result.winnerSeat;
      state.trickLeaderSeat = result.winnerSeat;

      if (state.tricksWon[result.winnerTeam] >= 2) {
        endHand(state, result.winnerTeam);
        startNextHand(state);
      }
    }
  }

  return { state };
};
