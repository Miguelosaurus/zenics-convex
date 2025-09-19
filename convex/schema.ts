import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  clips: defineTable({
    userId: v.id("users"),
    objectKey: v.string(),
    createdAt: v.number(),
    bytes: v.number(),
    durationMs: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    tags: v.array(v.string()),
    angle: v.optional(v.union(v.literal("front"), v.literal("side"), v.literal("45"))),
    apparatus: v.optional(v.union(v.literal("floor"), v.literal("rings"), v.literal("bar"), v.literal("parallettes"))),
    favorite: v.optional(v.boolean()),
    sessionId: v.optional(v.id("sessions")),
  })
    .index("by_user", ["userId"])
    .index("by_session", ["sessionId"])
    .index("by_user_and_created_at", ["userId", "createdAt"])
    .index("by_session_and_created_at", ["sessionId", "createdAt"]),

  sessions: defineTable({
    userId: v.id("users"),
    name: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_created_at", ["userId", "createdAt"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
