import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Id } from "./_generated/dataModel";

const DEV_USER_ID = "k17c9p6nqx6j9nqx6j9nqx6j9nqx6j9n" as Id<"users">;

// Configuration
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-matroska",
  "video/webm",
  "video/avi",
  "video/mov",
];

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
  
  // Dev mode: use fixed user ID
  return DEV_USER_ID;
}

export const requestUpload = mutation({
  args: {
    contentType: v.string(),
    ext: v.string(),
    sizeBytes: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    
    // Validate file size
    if (args.sizeBytes > MAX_FILE_SIZE) {
      throw new Error(`File size ${args.sizeBytes} bytes exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes (${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB)`);
    }
    
    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(args.contentType)) {
      throw new Error(`Content type ${args.contentType} is not allowed. Supported types: ${ALLOWED_MIME_TYPES.join(", ")}`);
    }
    
    // Generate unique object key
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const objectKey = `clips/${userId}/${timestamp}-${random}.${args.ext}`;
    
    const s3Client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: process.env.WASABI_BUCKET!,
      Key: objectKey,
      ContentType: args.contentType,
      ContentLength: args.sizeBytes,
    });
    
    const putUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes
    
    return {
      objectKey,
      putUrl,
    };
  },
});

export const finalizeUpload = mutation({
  args: {
    objectKey: v.string(),
    bytes: v.number(),
    durationMs: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    
    // Validate file size again
    if (args.bytes > MAX_FILE_SIZE) {
      throw new Error(`File size ${args.bytes} bytes exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`);
    }
    
    const clipId = await ctx.db.insert("clips", {
      userId,
      objectKey: args.objectKey,
      createdAt: Date.now(),
      bytes: args.bytes,
      durationMs: args.durationMs,
      width: args.width,
      height: args.height,
      tags: [],
      favorite: false,
    });
    
    return { clipId };
  },
});

export const getUploadLimits = query({
  args: {},
  handler: async () => {
    return {
      maxFileSizeBytes: MAX_FILE_SIZE,
      maxFileSizeMB: Math.round(MAX_FILE_SIZE / 1024 / 1024),
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    };
  },
});
