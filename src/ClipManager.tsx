import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../convex/_generated/dataModel";

export function ClipManager() {
  const [activeTab, setActiveTab] = useState<"upload" | "clips" | "search" | "sessions">("clips");
  
  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: "clips", label: "My Clips" },
            { id: "upload", label: "Upload" },
            { id: "search", label: "Search" },
            { id: "sessions", label: "Sessions" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "clips" && <ClipsList />}
      {activeTab === "upload" && <UploadClip />}
      {activeTab === "search" && <SearchClips />}
      {activeTab === "sessions" && <SessionManager />}
    </div>
  );
}

function UploadClip() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const requestUpload = useMutation(api.upload.requestUpload);
  const finalizeUpload = useMutation(api.upload.finalizeUpload);
  const uploadLimits = useQuery(api.upload.getUploadLimits);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      // Get file extension
      const ext = selectedFile.name.split('.').pop() || 'mp4';
      
      // Request upload URL
      const { objectKey, putUrl } = await requestUpload({
        contentType: selectedFile.type,
        ext,
        sizeBytes: selectedFile.size,
      });

      // Upload to Wasabi
      const uploadResponse = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': selectedFile.type,
        },
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      // Finalize upload
      await finalizeUpload({
        objectKey,
        bytes: selectedFile.size,
      });

      toast.success("Clip uploaded successfully!");
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Upload New Clip</h2>
      
      {uploadLimits && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Upload Limits:</strong> Max {uploadLimits.maxFileSizeMB}MB per file
          </p>
          <p className="text-sm text-blue-600 mt-1">
            Supported formats: {uploadLimits.allowedMimeTypes.join(', ')}
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Video File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {selectedFile && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm"><strong>File:</strong> {selectedFile.name}</p>
            <p className="text-sm"><strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            <p className="text-sm"><strong>Type:</strong> {selectedFile.type}</p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading..." : "Upload Clip"}
        </button>
      </div>
    </div>
  );
}

function ClipsList() {
  const [filters, setFilters] = useState({
    tags: [] as string[],
    angle: undefined as "front" | "side" | "45" | undefined,
    apparatus: undefined as "floor" | "rings" | "bar" | "parallettes" | undefined,
    favorite: undefined as boolean | undefined,
  });

  const clips = useQuery(api.clips.list, {
    paginationOpts: { numItems: 20, cursor: null },
    ...filters,
  });

  const updateMeta = useMutation(api.clips.updateMeta);
  const deleteClip = useMutation(api.clips.deleteClip);

  const handleToggleFavorite = async (clipId: Id<"clips">, currentFavorite: boolean) => {
    try {
      await updateMeta({
        id: clipId,
        favorite: !currentFavorite,
      });
      toast.success("Clip updated!");
    } catch (error) {
      toast.error("Failed to update clip");
    }
  };

  const handleDeleteClip = async (clipId: Id<"clips">) => {
    if (confirm("Are you sure you want to delete this clip?")) {
      try {
        await deleteClip({ id: clipId });
        toast.success("Clip deleted!");
      } catch (error) {
        toast.error("Failed to delete clip");
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-medium mb-3">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Angle</label>
            <select
              value={filters.angle || ""}
              onChange={(e) => setFilters(prev => ({ ...prev, angle: e.target.value as any || undefined }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All angles</option>
              <option value="front">Front</option>
              <option value="side">Side</option>
              <option value="45">45°</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Apparatus</label>
            <select
              value={filters.apparatus || ""}
              onChange={(e) => setFilters(prev => ({ ...prev, apparatus: e.target.value as any || undefined }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All apparatus</option>
              <option value="floor">Floor</option>
              <option value="rings">Rings</option>
              <option value="bar">Bar</option>
              <option value="parallettes">Parallettes</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Favorites</label>
            <select
              value={filters.favorite === undefined ? "" : filters.favorite.toString()}
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                favorite: e.target.value === "" ? undefined : e.target.value === "true" 
              }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All clips</option>
              <option value="true">Favorites only</option>
              <option value="false">Non-favorites</option>
            </select>
          </div>
        </div>
      </div>

      {/* Clips Grid */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">
            My Clips {clips && `(${clips.page.length})`}
          </h2>
        </div>
        
        {clips === undefined ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        ) : clips.page.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No clips found. Upload your first clip to get started!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {clips.page.map((clip) => (
              <ClipCard
                key={clip._id}
                clip={clip}
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDeleteClip}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClipCard({ clip, onToggleFavorite, onDelete }: {
  clip: any;
  onToggleFavorite: (id: Id<"clips">, favorite: boolean) => void;
  onDelete: (id: Id<"clips">) => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="aspect-video bg-gray-100 flex items-center justify-center relative">
        <VideoPlayer objectKey={clip.objectKey} />
      </div>
      
      <div className="p-3">
        <div className="flex justify-between items-start mb-2">
          <div className="text-sm text-gray-600 truncate flex-1">
            {clip.objectKey.split('/').pop()}
          </div>
          <button
            onClick={() => onToggleFavorite(clip._id, clip.favorite)}
            className={`ml-2 ${clip.favorite ? 'text-red-500' : 'text-gray-400'} hover:text-red-500`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div className="text-xs text-gray-500 space-y-1">
          <div>Size: {(clip.bytes / 1024 / 1024).toFixed(1)} MB</div>
          {clip.durationMs && <div>Duration: {(clip.durationMs / 1000).toFixed(1)}s</div>}
          {clip.angle && <div>Angle: {clip.angle}</div>}
          {clip.apparatus && <div>Apparatus: {clip.apparatus}</div>}
          {clip.tags.length > 0 && <div>Tags: {clip.tags.join(', ')}</div>}
          <div>Created: {new Date(clip.createdAt).toLocaleDateString()}</div>
        </div>

        <div className="mt-2 flex justify-between">
          <EditClipButton clip={clip} />
          <button
            onClick={() => onDelete(clip._id)}
            className="text-red-600 hover:text-red-800 text-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoPlayer({ objectKey }: { objectKey: string }) {
  const [showVideo, setShowVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const getPlaybackUrl = useMutation(api.clips.getPlaybackUrl);

  const handlePlay = async () => {
    if (showVideo && videoUrl) {
      setShowVideo(false);
      return;
    }

    setLoading(true);
    try {
      const result = await getPlaybackUrl({ objectKey });
      setVideoUrl(result.getUrl);
      setShowVideo(true);
    } catch (error) {
      toast.error("Failed to load video");
    } finally {
      setLoading(false);
    }
  };

  if (showVideo && videoUrl) {
    return (
      <div className="w-full h-full relative">
        <video
          src={videoUrl}
          controls
          className="w-full h-full object-cover"
          onError={() => {
            toast.error("Failed to load video");
            setShowVideo(false);
          }}
        />
        <button
          onClick={() => setShowVideo(false)}
          className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-75"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handlePlay}
      disabled={loading}
      className="bg-blue-600 text-white rounded-full p-3 hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? (
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
      ) : (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}

function EditClipButton({ clip }: { clip: any }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    tags: clip.tags.join(', '),
    angle: clip.angle || '',
    apparatus: clip.apparatus || '',
  });
  
  const updateMeta = useMutation(api.clips.updateMeta);

  const handleSave = async () => {
    try {
      await updateMeta({
        id: clip._id,
        tags: formData.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t),
        angle: formData.angle as any || undefined,
        apparatus: formData.apparatus as any || undefined,
      });
      toast.success("Clip updated!");
      setIsEditing(false);
    } catch (error) {
      toast.error("Failed to update clip");
    }
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="text-blue-600 hover:text-blue-800 text-sm"
      >
        Edit
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Edit Clip</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="handstand, training, progress"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Angle</label>
            <select
              value={formData.angle}
              onChange={(e) => setFormData(prev => ({ ...prev, angle: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Select angle</option>
              <option value="front">Front</option>
              <option value="side">Side</option>
              <option value="45">45°</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Apparatus</label>
            <select
              value={formData.apparatus}
              onChange={(e) => setFormData(prev => ({ ...prev, apparatus: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Select apparatus</option>
              <option value="floor">Floor</option>
              <option value="rings">Rings</option>
              <option value="bar">Bar</option>
              <option value="parallettes">Parallettes</option>
            </select>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={() => setIsEditing(false)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchClips() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any>(null);
  
  // For now, we'll show a placeholder since search needs to be implemented as a mutation
  const handleSearch = () => {
    if (!query.trim()) return;
    
    toast.info("Search functionality will be implemented with proper API calls");
    setSearchResults({ results: [], isDone: true });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Search Clips</h2>
        
        <div className="flex space-x-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by tags, filename, angle, apparatus..."
            className="flex-1 border border-gray-300 rounded-md px-3 py-2"
          />
          <button
            onClick={handleSearch}
            disabled={!query.trim()}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Search
          </button>
        </div>
        
        <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Search functionality is available in the backend but needs proper integration. 
            For now, use the filters in the "My Clips" tab to find specific clips.
          </p>
        </div>
      </div>

      {searchResults && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold">Search Results</h3>
          </div>
          <div className="p-8 text-center text-gray-500">
            Search results will appear here once the API is properly integrated.
          </div>
        </div>
      )}
    </div>
  );
}

function SessionManager() {
  const [newSessionName, setNewSessionName] = useState("");
  
  const sessions = useQuery(api.sessions.list);
  const createSession = useMutation(api.sessions.create);
  const deleteSession = useMutation(api.sessions.deleteSession);

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return;
    
    try {
      await createSession({ name: newSessionName });
      setNewSessionName("");
      toast.success("Session created!");
    } catch (error) {
      toast.error("Failed to create session");
    }
  };

  const handleDeleteSession = async (sessionId: Id<"sessions">) => {
    if (confirm("Are you sure you want to delete this session?")) {
      try {
        await deleteSession({ id: sessionId });
        toast.success("Session deleted!");
      } catch (error) {
        toast.error("Failed to delete session");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Create New Session</h2>
        
        <div className="flex space-x-3">
          <input
            type="text"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateSession()}
            placeholder="Session name (e.g., Morning Training, Handstand Practice)"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2"
          />
          <button
            onClick={handleCreateSession}
            disabled={!newSessionName.trim()}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">
            Training Sessions {sessions && `(${sessions.length})`}
          </h3>
        </div>
        
        {sessions === undefined ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No sessions yet. Create your first training session!
          </div>
        ) : (
          <div className="divide-y">
            {sessions.map((session) => (
              <div key={session._id} className="p-4 flex justify-between items-center">
                <div>
                  <h4 className="font-medium">{session.name}</h4>
                  <p className="text-sm text-gray-500">
                    Created {new Date(session.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteSession(session._id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
