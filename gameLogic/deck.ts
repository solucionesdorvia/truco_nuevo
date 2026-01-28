import { Card, Rank, Suit } from "./types";

const suits: Suit[] = ["espada", "basto", "oro", "copa"];
const ranks: Rank[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

export const buildDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
};

export const shuffleDeck = (cards: Card[]): Card[] => {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};
