import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Image as ImageIcon, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const CreatePost = () => {
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleMediaSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setMediaFile(file);
    setMediaType(file.type.startsWith("image/") ? "image" : "video");

    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveToDevice = () => {
    if (!mediaPreview || !mediaFile) {
      toast.error("No media to save");
      return;
    }

    const link = document.createElement("a");
    link.href = mediaPreview;
    link.download = `post-${Date.now()}.${mediaFile.name.split('.').pop()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Media saved to your device!");
  };

  const handlePost = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to post");
      return;
    }

    if (!content.trim() && !mediaFile) {
      toast.error("Please add content or media to your post");
      return;
    }

    setPosting(true);
    try {
      let mediaUrl = null;

      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, mediaFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('posts')
          .getPublicUrl(fileName);

        mediaUrl = publicUrl;
      }

      const { error } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          content: content.trim() || null,
          media_url: mediaUrl,
          media_type: mediaType,
        });

      if (error) throw error;

      toast.success("Post created successfully!");
      navigate("/feed");
    } catch (error: any) {
      console.error("Error creating post:", error);
      toast.error(error.message || "Failed to create post");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="max-w-screen-lg mx-auto px-4 h-16 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate("/feed")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold">Create Post</h1>
          <div className="flex gap-2">
            {mediaFile && (
              <Button variant="outline" onClick={handleSaveToDevice}>
                Save
              </Button>
            )}
            <Button onClick={handlePost} disabled={posting || (!content.trim() && !mediaFile)}>
              {posting ? "Posting..." : "Post"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-lg mx-auto px-4 py-4">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          className="min-h-[200px] resize-none border-none focus-visible:ring-0 text-base"
        />

        {mediaPreview && (
          <div className="mt-4 relative">
            {mediaType === "image" ? (
              <img
                src={mediaPreview}
                alt="Preview"
                className="max-h-96 rounded-lg object-cover"
              />
            ) : (
              <video
                src={mediaPreview}
                controls
                className="max-h-96 rounded-lg"
              />
            )}
            <Button
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => {
                setMediaFile(null);
                setMediaPreview(null);
                setMediaType(null);
              }}
            >
              Remove
            </Button>
          </div>
        )}

        <div className="flex gap-4 mt-4 pt-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => document.getElementById('media-upload')?.click()}
          >
            <ImageIcon className="w-5 h-5" />
            Photo/Video
          </Button>
          <input
            id="media-upload"
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleMediaSelect}
          />
        </div>
      </main>
    </div>
  );
};

export default CreatePost;
