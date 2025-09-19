import { query as defineQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

const DEV_USER_ID = "k17c9p6nqx6j9nqx6j9nqx6j9nqx6j9n" as Id<"users">;

async function getCurrentUserId(ctx: any): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId) return userId;
  return DEV_USER_ID;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);
}

function matchesQuery(clip: any, queryTokens: string[]): boolean {
  // Create searchable text from clip fields
  const searchableFields = [
    ...clip.tags,
    clip.objectKey,
    clip.angle || '',
    clip.apparatus || '',
  ];
  
  const searchText = searchableFields.join(' ').toLowerCase();
  const searchTokens = tokenize(searchText);
  
  // Check if all query tokens match at least one search token
  return queryTokens.every(queryToken =>
    searchTokens.some(searchToken =>
      searchToken.includes(queryToken) || queryToken.includes(searchToken)
    )
  );
}

export const query = defineQuery({
  args: {
    q: v.string(),
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const limit = args.limit || 20;
    
    if (!args.q.trim()) {
      return {
        results: [],
        cursor: null,
        isDone: true,
      };
    }
    
    const queryTokens = tokenize(args.q);
    if (queryTokens.length === 0) {
      return {
        results: [],
        cursor: null,
        isDone: true,
      };
    }
    
    // Get all clips for the user (in practice, you might want to limit this)
    const allClips = await ctx.db
      .query("clips")
      .withIndex("by_user_and_created_at", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    
    // Filter clips that match the search query
    const matchingClips = allClips.filter(clip => matchesQuery(clip, queryTokens));
    
    // Simple cursor-based pagination
    let startIndex = 0;
    if (args.cursor) {
      try {
        startIndex = parseInt(args.cursor, 10);
      } catch {
        startIndex = 0;
      }
    }
    
    const endIndex = startIndex + limit;
    const results = matchingClips.slice(startIndex, endIndex);
    const hasMore = endIndex < matchingClips.length;
    
    return {
      results,
      cursor: hasMore ? endIndex.toString() : null,
      isDone: !hasMore,
    };
  },
});
