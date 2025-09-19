import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { paginationOptsValidator } from "convex/server";
import { Id } from "./_generated/dataModel";

const DEV_USER_ID = "k17c9p6nqx6j9nqx6j9nqx6j9nqx6j9n" as Id<"users">;

function getS3Client() {
  return new S3Client({
    region: process.env.WASABI_REGION!,
    endpoint: process.env.WASABI_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.WASABI_ACCESS_KEY_ID!,
      secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  });
}

async function getCurrentUserId(ctx: any): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId) return userId;
  return DEV_USER_ID;
}

export const getPlaybackUrl = mutation({
  args: {
    objectKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    
    // Verify user owns this clip
    const clip = await ctx.db
      .query("clips")
      .filter((q) => q.and(
        q.eq(q.field("userId"), userId),
        q.eq(q.field("objectKey"), args.objectKey)
      ))
      .unique();
    
    if (!clip) {
      throw new Error("Clip not found or access denied");
    }
    
    const s3Client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: process.env.WASABI_BUCKET!,
      Key: args.objectKey,
    });
    
    const getUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
    
    return { getUrl };
  },
});

export const get = query({
  args: {
    id: v.id("clips"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    
    const clip = await ctx.db.get(args.id);
    if (!clip || clip.userId !== userId) {
      throw new Error("Clip not found or access denied");
    }
    
    return clip;
  },
});

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    // Filters
    tags: v.optional(v.array(v.string())),
    angle: v.optional(v.union(v.literal("front"), v.literal("side"), v.literal("45"))),
    apparatus: v.optional(v.union(v.literal("floor"), v.literal("rings"), v.literal("bar"), v.literal("parallettes"))),
    favorite: v.optional(v.boolean()),
    sessionId: v.optional(v.id("sessions")),
    dateRange: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    
    let query = ctx.db
      .query("clips")
      .withIndex("by_user_and_created_at", (q) => q.eq("userId", userId));
    
    // Apply date range filter if provided
    if (args.dateRange) {
      query = query.filter((q) => q.and(
        q.gte(q.field("createdAt"), args.dateRange!.start),
        q.lte(q.field("createdAt"), args.dateRange!.end)
      ));
    }
    
    // Get all clips first, then filter in JavaScript
    let results = await query.order("desc").collect();
    
    // Apply filters in JavaScript
    if (args.tags && args.tags.length > 0) {
      results = results.filter(clip => 
        args.tags!.some(tag => clip.tags.includes(tag))
      );
    }
    
    if (args.angle !== undefined) {
      results = results.filter(clip => clip.angle === args.angle);
    }
    
    if (args.apparatus !== undefined) {
      results = results.filter(clip => clip.apparatus === args.apparatus);
    }
    
    if (args.favorite !== undefined) {
      results = results.filter(clip => clip.favorite === args.favorite);
    }
    
    if (args.sessionId !== undefined) {
      results = results.filter(clip => clip.sessionId === args.sessionId);
    }
    
    // Manual pagination
    const cursor = args.paginationOpts.cursor;
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const endIndex = startIndex + args.paginationOpts.numItems;
    const page = results.slice(startIndex, endIndex);
    const hasMore = endIndex < results.length;
    
    return {
      page,
      isDone: !hasMore,
      continueCursor: hasMore ? endIndex.toString() : null,
    };
  },
});

export const updateMeta = mutation({
  args: {
    id: v.id("clips"),
    tags: v.optional(v.array(v.string())),
    angle: v.optional(v.union(v.literal("front"), v.literal("side"), v.literal("45"))),
    apparatus: v.optional(v.union(v.literal("floor"), v.literal("rings"), v.literal("bar"), v.literal("parallettes"))),
    favorite: v.optional(v.boolean()),
    sessionId: v.optional(v.id("sessions")),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    
    const clip = await ctx.db.get(args.id);
    if (!clip || clip.userId !== userId) {
      throw new Error("Clip not found or access denied");
    }
    
    const updates: any = {};
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.angle !== undefined) updates.angle = args.angle;
    if (args.apparatus !== undefined) updates.apparatus = args.apparatus;
    if (args.favorite !== undefined) updates.favorite = args.favorite;
    if (args.sessionId !== undefined) updates.sessionId = args.sessionId;
    
    await ctx.db.patch(args.id, updates);
    
    return { success: true };
  },
});

export const deleteClip = mutation({
  args: {
    id: v.id("clips"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    
    const clip = await ctx.db.get(args.id);
    if (!clip || clip.userId !== userId) {
      throw new Error("Clip not found or access denied");
    }
    
    await ctx.db.delete(args.id);
    
    return { success: true };
  },
});
