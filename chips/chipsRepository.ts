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
  }
};
