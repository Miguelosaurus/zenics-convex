import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

const DEV_USER_ID = "k17c9p6nqx6j9nqx6j9nqx6j9nqx6j9n" as Id<"users">;

async function getCurrentUserId(ctx: any): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId) return userId;
  return DEV_USER_ID;
}

export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    
    const sessionId = await ctx.db.insert("sessions", {
      userId,
      name: args.name,
      createdAt: Date.now(),
    });
    
    return { sessionId };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    
    return await ctx.db
      .query("sessions")
      .withIndex("by_user_and_created_at", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const rename = mutation({
  args: {
    id: v.id("sessions"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    
    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found or access denied");
    }
    
    await ctx.db.patch(args.id, { name: args.name });
    
    return { success: true };
  },
});

export const deleteSession = mutation({
  args: {
    id: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    
    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found or access denied");
    }
    
    await ctx.db.delete(args.id);
    
    return { success: true };
  },
});
