import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Share2, Repeat2, Download } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface PostCardProps {
  post: {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    media_url?: string;
    media_type?: string;
    profiles?: {
      username: string;
      avatar_url: string;
    };
  };
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  currentUserId: string | undefined;
}

const PostCard = ({ post, likesCount, commentsCount, isLiked, currentUserId }: PostCardProps) => {
  const [liked, setLiked] = useState(isLiked);
  const [likes, setLikes] = useState(likesCount);
  const navigate = useNavigate();

  const handleLike = async () => {
    if (!currentUserId) {
      toast.error("You must be logged in to like posts");
      return;
    }

    try {
      if (liked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId);

        if (error) throw error;
        setLiked(false);
        setLikes(prev => prev - 1);
      } else {
        const { error } = await supabase
          .from("likes")
          .insert({ post_id: post.id, user_id: currentUserId });

        if (error) throw error;
        setLiked(true);
        setLikes(prev => prev + 1);
      }
    } catch (error: any) {
      console.error("Error toggling like:", error);
      toast.error("Failed to update like");
    }
  };

  const handleComment = () => {
    navigate(`/post/${post.id}`);
  };

  const handleShare = () => {
    toast.info("Share feature coming soon!");
  };

  const handleRepost = () => {
    toast.info("Repost feature coming soon!");
  };

  const handleDownload = async () => {
    if (!post.media_url) return;
    
    try {
      const response = await fetch(post.media_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `post-${post.id}.${post.media_type === 'image' ? 'jpg' : 'mp4'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Downloaded successfully!");
    } catch (error) {
      console.error("Error downloading:", error);
      toast.error("Failed to download");
    }
  };

  return (
    <div className="border-b border-border p-4 hover:bg-accent/5 transition-colors">
      <div className="flex gap-3">
        <Avatar 
          className="w-10 h-10 cursor-pointer" 
          onClick={() => navigate(`/user/${post.user_id}`)}
        >
          <AvatarImage src={post.profiles?.avatar_url} />
          <AvatarFallback className="bg-gradient-to-r from-[hsl(291,64%,42%)] via-[hsl(340,82%,52%)] to-[hsl(25,95%,53%)] text-white">
            {post.profiles?.username?.[0]?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span 
              className="font-semibold cursor-pointer hover:underline"
              onClick={() => navigate(`/user/${post.user_id}`)}
            >
              {post.profiles?.username || "Unknown"}
            </span>
            <span className="text-sm text-muted-foreground">
              · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </span>
          </div>

          {post.content && (
            <p className="mt-2 text-foreground whitespace-pre-wrap">{post.content}</p>
          )}

          {post.media_url && (
            <div className="mt-3 rounded-lg overflow-hidden relative group">
              {post.media_type === "image" ? (
                <img
                  src={post.media_url}
                  alt="Post media"
                  className="w-full max-h-[500px] object-cover"
                />
              ) : post.media_type === "video" ? (
                <video
                  src={post.media_url}
                  controls
                  className="w-full max-h-[500px]"
                />
              ) : null}
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleDownload}
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-6 mt-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 hover:text-[hsl(340,82%,52%)]"
              onClick={handleLike}
            >
              <Heart className={`w-5 h-5 ${liked ? "fill-[hsl(340,82%,52%)] text-[hsl(340,82%,52%)]" : ""}`} />
              {likes > 0 && <span className="text-sm">{likes}</span>}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="gap-2 hover:text-blue-500"
              onClick={handleComment}
            >
              <MessageCircle className="w-5 h-5" />
              {commentsCount > 0 && <span className="text-sm">{commentsCount}</span>}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="gap-2 hover:text-green-500"
              onClick={handleRepost}
            >
              <Repeat2 className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="gap-2 hover:text-blue-400"
              onClick={handleShare}
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostCard;
