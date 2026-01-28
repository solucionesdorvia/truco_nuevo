import { Card } from "./types";

export const getTrucoPower = (card: Card): number => {
  const { rank, suit } = card;

  if (rank === 1 && suit === "espada") return 14;
  if (rank === 1 && suit === "basto") return 13;
  if (rank === 7 && suit === "espada") return 12;
  if (rank === 7 && suit === "oro") return 11;
  if (rank === 3) return 10;
  if (rank === 2) return 9;
  if (rank === 1) return 8;
  if (rank === 12) return 7;
  if (rank === 11) return 6;
  if (rank === 10) return 5;
  if (rank === 7) return 4;
  if (rank === 6) return 3;
  if (rank === 5) return 2;
  return 1;
};

export const getEnvidoCardValue = (card: Card): number => {
  if (card.rank >= 10) return 0;
  return card.rank;
};
