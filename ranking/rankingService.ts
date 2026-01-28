import { rankingRepository } from "./rankingRepository";

export const rankingService = {
  getTop(limit = 50) {
    return rankingRepository.getTop(limit);
  },

  recordMatch(params: { winners: string[]; losers: string[] }) {
    const now = new Date().toISOString();
    const updateRow = (userId: string, win: boolean) => {
      const existing = rankingRepository.getByUserId(userId);
      const next = {
        userId,
        points: (existing?.points ?? 0) + (win ? 3 : 0),
        wins: (existing?.wins ?? 0) + (win ? 1 : 0),
        losses: (existing?.losses ?? 0) + (win ? 0 : 1),
        updatedAt: now
      };
      rankingRepository.upsert(next);
    };

    params.winners.forEach((id) => updateRow(id, true));
    params.losers.forEach((id) => updateRow(id, false));
  }
};
