import {and, count, eq, gte, desc, type InferInsertModel   } from 'drizzle-orm';

import {generations} from '@/db/schema';
import {db} from '@/db/index';

/** Start of current month (UTC), used for monthly generations quota */
export function utcMonthStart() {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1, 0, 0, 0));
}

export async function countGenerationsSince(clerkUserId: string, since: Date) {
    const [row] = await db
    .select({c:count()})
    .from(generations)
    .where(and(
        eq(generations.clerkUserId, clerkUserId),
        gte(generations.createdAt, since)
    ));
    return Number(row?.c ?? 0);   
}

export async function listUserGenerationsSummaries(clerkUserId: string) {
    return await db
    .select()
    .from(generations)
    .where(eq(generations.clerkUserId, clerkUserId))
    .orderBy(desc(generations.createdAt))
    .limit(100);
}

type InsertGenerationInput = Omit<InferInsertModel<typeof generations>, 'id' | 'createdAt'>;
export async function createGeneration(input: InsertGenerationInput) {
    const [row] = await db
    .insert(generations)
    .values(input)
    .returning();
    return row;
}