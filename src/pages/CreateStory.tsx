import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

const CreateStory = () => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [file, setFile] = useState<File | null>(null);
  const navigate = useNavigate();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const type = selectedFile.type.startsWith("video") ? "video" : "image";
    setMediaType(type);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleSaveToDevice = () => {
    if (!preview || !file) {
      toast.error("No file to save");
      return;
    }

    const link = document.createElement("a");
    link.href = preview;
    link.download = `story-${Date.now()}.${file.name.split('.').pop()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Story saved to your device!");
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `stories/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("posts")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from("stories")
        .insert({
          user_id: user.id,
          media_url: publicUrl,
          media_type: mediaType,
        });

      if (insertError) throw insertError;

      toast.success("Story shared successfully!");
      navigate("/feed");
    } catch (error: any) {
      console.error("Error creating story:", error);
      toast.error("Failed to create story");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="max-w-screen-lg mx-auto px-4 h-16 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate("/feed")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Create Story</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSaveToDevice}
              disabled={!file}
            >
              Save
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !file}
              className="bg-gradient-to-r from-[hsl(291,64%,42%)] via-[hsl(340,82%,52%)] to-[hsl(25,95%,53%)]"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Share"
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-lg mx-auto p-4">
        {!preview ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full max-w-md h-64 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors"
            >
              <Upload className="w-12 h-12 mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Click to upload photo or video
              </p>
              <p className="text-xs text-muted-foreground">
                Story will disappear after 24 hours
              </p>
              <input
                id="file-upload"
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="relative w-full max-w-md">
              {mediaType === "image" ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full rounded-lg"
                />
              ) : (
                <video
                  src={preview}
                  controls
                  className="w-full rounded-lg"
                />
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setPreview(null);
                  setFile(null);
                }}
                className="mt-4 w-full"
              >
                Choose Different File
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CreateStory;
