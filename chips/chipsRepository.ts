import db from "../db";

export const chipsRepository = {
  recordTransaction(params: {
    id: string;
    userId: string;
    amount: number;
    reason: string;
    metadata?: string;
    createdAt: string;
  }): void {
    db.prepare(
      "INSERT INTO chips_transactions (id, user_id, amount, reason, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      params.id,
      params.userId,
      params.amount,
      params.reason,
      params.metadata ?? null,
      params.createdAt
    );
  },
  listTransactions(userId: string, limit = 20): Array<{
    id: string;
    amount: number;
    reason: string;
    metadata?: string | null;
    created_at: string;
  }> {
    return db.prepare(
      "SELECT id, amount, reason, metadata, created_at FROM chips_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
    ).all(userId, limit) as Array<{
      id: string;
      amount: number;
      reason: string;
      metadata?: string | null;
      created_at: string;
    }>;
  }
};
