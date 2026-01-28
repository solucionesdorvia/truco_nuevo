import db from "../db";

export interface RankingRow {
  userId: string;
  username?: string;
  points: number;
  wins: number;
  losses: number;
  updatedAt: string;
}

export const rankingRepository = {
  getTop(limit: number): RankingRow[] {
    const rows = db
      .prepare(
        `SELECT rankings.user_id as userId,
                users.username as username,
                rankings.points as points,
                rankings.wins as wins,
                rankings.losses as losses,
                rankings.updated_at as updatedAt
         FROM rankings
         LEFT JOIN users ON users.id = rankings.user_id
         ORDER BY rankings.points DESC, rankings.wins DESC
         LIMIT ?`
      )
      .all(limit);
    return rows as RankingRow[];
  },

  getByUserId(userId: string): RankingRow | null {
    const row = db
      .prepare(
        `SELECT rankings.user_id as userId,
                users.username as username,
                rankings.points as points,
                rankings.wins as wins,
                rankings.losses as losses,
                rankings.updated_at as updatedAt
         FROM rankings
         LEFT JOIN users ON users.id = rankings.user_id
         WHERE rankings.user_id = ?`
      )
      .get(userId);
    return row ? (row as RankingRow) : null;
  },

  upsert(row: RankingRow): void {
    db.prepare(
      `INSERT INTO rankings (id, user_id, points, wins, losses, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         points = excluded.points,
         wins = excluded.wins,
         losses = excluded.losses,
         updated_at = excluded.updated_at`
    ).run(
      row.userId,
      row.userId,
      row.points,
      row.wins,
      row.losses,
      row.updatedAt
    );
  }
};
