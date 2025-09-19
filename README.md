# Zenics Backend MVP

A bare-bones backend for Zenics - a "second camera roll" for calisthenics clips.

## Quick Start

1. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Fill in your Wasabi credentials in .env.local
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Deploy Backend**
   ```bash
   npx convex dev
   ```

4. **Set Environment Variables**
   In your Convex dashboard, go to Settings → Environment Variables and add:
   - `WASABI_ACCESS_KEY_ID`
   - `WASABI_SECRET_ACCESS_KEY`
   - `WASABI_BUCKET`
   - `WASABI_REGION`
   - `WASABI_ENDPOINT`

5. **Configure CORS on Wasabi**
   Set up your Wasabi bucket with this CORS configuration:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedOrigins": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

## Upload Flow

The typical flow for uploading and managing clips:

1. **Check Upload Limits**
   ```js
   const limits = await convex.query(api.upload.getUploadLimits);
   // { maxFileSizeBytes: 524288000, maxFileSizeMB: 500, allowedMimeTypes: [...] }
   ```

2. **Request Upload URL**
   ```js
   const { objectKey, putUrl } = await convex.mutation(api.upload.requestUpload, {
     contentType: "video/mp4",
     ext: "mp4",
     sizeBytes: 1024000
   });
   ```

3. **PUT to Wasabi**
   ```js
   await fetch(putUrl, {
     method: "PUT",
     headers: { "Content-Type": "video/mp4" },
     body: videoFile
   });
   ```

4. **Finalize Upload**
   ```js
   const { clipId } = await convex.mutation(api.upload.finalizeUpload, {
     objectKey,
     bytes: 1024000,
     durationMs: 30000,
     width: 1920,
     height: 1080
   });
   ```

5. **List Clips with Filters**
   ```js
   const clips = await convex.query(api.clips.list, {
     paginationOpts: { numItems: 20, cursor: null },
     tags: ["handstand", "training"],
     angle: "front",
     apparatus: "floor",
     favorite: true,
     dateRange: { start: Date.now() - 7*24*60*60*1000, end: Date.now() }
   });
   ```

6. **Search Clips**
   ```js
   const results = await convex.query(api.search.query, {
     q: "handstand training",
     limit: 10,
     cursor: null
   });
   ```

7. **Get Playback URL**
   ```js
   const { getUrl } = await convex.query(api.clips.getPlaybackUrl, {
     objectKey: "clips/user123/1234567890-abc123.mp4"
   });
   ```

## API Functions

### Upload
- `upload.getUploadLimits()` - Get file size and type limits
- `upload.requestUpload({ contentType, ext, sizeBytes })` - Get presigned PUT URL (5min expiry)
- `upload.finalizeUpload({ objectKey, bytes, durationMs?, width?, height? })` - Save clip metadata

### Clips
- `clips.getPlaybackUrl({ objectKey })` - Get presigned GET URL (1hr expiry)
- `clips.get({ id })` - Get single clip
- `clips.list({ paginationOpts, tags?, angle?, apparatus?, favorite?, sessionId?, dateRange? })` - List clips with filters
- `clips.updateMeta({ id, tags?, angle?, apparatus?, favorite?, sessionId? })` - Update metadata
- `clips.deleteClip({ id })` - Delete clip

### Search
- `search.query({ q, limit?, cursor? })` - Search clips by tags, filename, and metadata

### Sessions
- `sessions.create({ name })` - Create session
- `sessions.list()` - List sessions
- `sessions.rename({ id, name })` - Rename session
- `sessions.deleteSession({ id })` - Delete session

## Schema

### Clips
- `userId` - Owner ID
- `objectKey` - Wasabi S3 object key
- `createdAt` - Timestamp
- `bytes` - File size
- `durationMs?` - Video duration
- `width?`, `height?` - Video dimensions
- `tags` - Array of strings
- `angle?` - "front" | "side" | "45"
- `apparatus?` - "floor" | "rings" | "bar" | "parallettes"
- `favorite?` - Boolean
- `sessionId?` - Reference to session

### Sessions
- `userId` - Owner ID
- `name` - Session name
- `createdAt` - Timestamp

## React Native Example

Minimal Expo-compatible snippet for uploading and playing clips:

```jsx
import { Video } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { ConvexReactClient } from 'convex/react';
import { api } from './convex/_generated/api';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL);

export default function ClipManager() {
  const [clips, setClips] = useState([]);
  const [playbackUrl, setPlaybackUrl] = useState(null);

  // Upload a clip
  const uploadClip = async () => {
    try {
      // Pick video file
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) return;
      
      const file = result.assets[0];
      
      // Request upload URL
      const { objectKey, putUrl } = await convex.mutation(api.upload.requestUpload, {
        contentType: file.mimeType,
        ext: file.name.split('.').pop(),
        sizeBytes: file.size,
      });
      
      // Upload to Wasabi
      const response = await fetch(file.uri);
      const blob = await response.blob();
      
      await fetch(putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.mimeType },
        body: blob,
      });
      
      // Finalize upload
      await convex.mutation(api.upload.finalizeUpload, {
        objectKey,
        bytes: file.size,
      });
      
      // Refresh clips list
      loadClips();
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  // Load clips
  const loadClips = async () => {
    const result = await convex.query(api.clips.list, {
      paginationOpts: { numItems: 20, cursor: null }
    });
    setClips(result.page);
  };

  // Play a clip
  const playClip = async (objectKey) => {
    const { getUrl } = await convex.query(api.clips.getPlaybackUrl, { objectKey });
    setPlaybackUrl(getUrl);
  };

  return (
    <View>
      <Button title="Upload Clip" onPress={uploadClip} />
      <Button title="Load Clips" onPress={loadClips} />
      
      {clips.map(clip => (
        <TouchableOpacity key={clip._id} onPress={() => playClip(clip.objectKey)}>
          <Text>{clip.objectKey}</Text>
        </TouchableOpacity>
      ))}
      
      {playbackUrl && (
        <Video
          source={{ uri: playbackUrl }}
          style={{ width: 300, height: 200 }}
          useNativeControls
          resizeMode="contain"
        />
      )}
    </View>
  );
}
```

## Troubleshooting

### Common Issues

**1. "Access Denied" or 403 errors**
- Check that your Wasabi credentials are correct
- Verify the bucket name matches your configuration
- Ensure CORS is properly configured on your bucket

**2. "SignatureDoesNotMatch" errors**
- Verify your `WASABI_REGION` and `WASABI_ENDPOINT` match your bucket's region
- Common regions:
  - `us-east-1`: `https://s3.us-east-1.wasabisys.com`
  - `us-central-1`: `https://s3.us-central-1.wasabisys.com`
  - `us-west-1`: `https://s3.us-west-1.wasabisys.com`

**3. "Request has expired" errors**
- Presigned URLs expire after 5 minutes for uploads and 1 hour for downloads
- Request a new URL if the old one has expired

**4. Upload fails with large files**
- Check file size against the 500MB limit
- Ensure stable internet connection for large uploads
- Consider chunked uploads for very large files

**5. CORS errors in browser**
- Verify CORS configuration on your Wasabi bucket
- Check that `AllowedOrigins` includes your domain or use `["*"]` for development

**6. Environment variables not found**
- Ensure all required environment variables are set in your Convex dashboard
- Variables must be set in the Convex dashboard, not just in `.env.local`

### File Type Support

Currently supported video formats:
- MP4 (`video/mp4`)
- QuickTime (`video/quicktime`)
- Matroska (`video/x-matroska`)
- WebM (`video/webm`)
- AVI (`video/avi`)
- MOV (`video/mov`)

### Performance Tips

- Use pagination for large clip collections
- Implement client-side caching for playback URLs
- Consider thumbnail generation for better UX
- Use appropriate video compression before upload

## Development

The backend includes a dev mode that uses a fixed user ID when authentication is not available. In production, all operations are scoped to the authenticated user.

## Deployment

1. Set up environment variables in your Convex dashboard
2. Deploy with `npx convex deploy`
