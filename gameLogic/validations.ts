import { GameAction, GameState } from "./types";

export const validateAction = (state: GameState, action: GameAction): string | null => {
  const player = state.players.find((p) => p.userId === action.userId);
  if (!player) {
    return "Player not seated in this room";
  }

  if (state.phase !== "playing") {
    return "Game is not in playing phase";
  }

  if (state.pendingTruco || state.pendingEnvido) {
    if (action.type === "respond_truco" || action.type === "respond_envido") {
      return null;
    }

    return "Pending call must be resolved first";
  }

  if (action.type === "play_card") {
    if (player.seat !== state.currentTurnSeat) {
      return "Not your turn";
    }

    const hasCard = player.hand.some(
      (card) => card.rank === action.card.rank && card.suit === action.card.suit
    );
    if (!hasCard) {
      return "Card not in player hand";
    }
  }

  if (action.type === "call_envido") {
    if (state.trickNumber !== 1 || state.table.length > 0) {
      return "Envido can only be called before the first trick";
    }

    if (state.envidoResolved) {
      return "Envido already resolved";
    }
  }

  return null;
};
