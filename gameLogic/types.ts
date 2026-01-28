import { TeamId } from "../rooms/roomTypes";

export type Suit = "espada" | "basto" | "oro" | "copa";
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type GamePhase = "waiting" | "dealing" | "playing" | "hand_end" | "game_end";

export interface PlayerState {
  userId: string;
  seat: number;
  team: TeamId;
  hand: Card[];
  isDealer: boolean;
}

export interface TeamState {
  id: TeamId;
  score: number;
}

export interface TrucoPendingState {
  level: 2 | 3 | 4;
  calledBy: TeamId;
  respondBy: TeamId;
}

export interface EnvidoPendingState {
  level: "envido" | "real_envido" | "falta_envido";
  calledBy: TeamId;
  respondBy: TeamId;
}

export interface TrickPlay {
  userId: string;
  team: TeamId;
  seat: number;
  card: Card;
}

export interface GameState {
  id: string;
  roomId: string;
  phase: GamePhase;
  deck: Card[];
  table: TrickPlay[];
  currentTurnSeat: number;
  trickLeaderSeat: number;
  trickNumber: 1 | 2 | 3;
  players: PlayerState[];
  teams: Record<TeamId, TeamState>;
  tricksWon: Record<TeamId, number>;
  targetScore: 15 | 30;
  handNumber: number;
  manoSeat: number;
  trucoLevel: 1 | 2 | 3 | 4;
  pendingTruco?: TrucoPendingState;
  pendingEnvido?: EnvidoPendingState;
  envidoResolved: boolean;
  lastHandWinner?: TeamId;
  lastTrickWinner?: TeamId;
}

export type GameAction =
  | { type: "play_card"; userId: string; card: Card }
  | { type: "call_truco"; userId: string }
  | { type: "respond_truco"; userId: string; accept: boolean }
  | { type: "call_envido"; userId: string; level: "envido" | "real_envido" | "falta_envido" }
  | { type: "respond_envido"; userId: string; accept: boolean }
  | { type: "fold"; userId: string };
