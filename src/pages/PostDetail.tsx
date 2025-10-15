import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Heart, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Post {
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
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles?: {
    username: string;
    avatar_url: string;
  };
}

const PostDetail = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();

  useEffect(() => {
    loadPostAndComments();
  }, [postId]);

  const loadPostAndComments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id);

      // Load post
      const { data: postData, error: postError } = await supabase
        .from("posts")
        .select("*")
        .eq("id", postId)
        .single();

      if (postError) throw postError;

      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("user_id", postData.user_id)
        .single();

      setPost({ ...postData, profiles: profileData });

      // Load comments
      const { data: commentsData } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (commentsData) {
        const userIds = [...new Set(commentsData.map(c => c.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, username, avatar_url")
          .in("user_id", userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]));
        
        const commentsWithProfiles = commentsData.map(comment => ({
          ...comment,
          profiles: profilesMap.get(comment.user_id)
        }));

        setComments(commentsWithProfiles);
      }

      // Load likes
      const { data: likesData } = await supabase
        .from("likes")
        .select("user_id")
        .eq("post_id", postId);

      setLikesCount(likesData?.length || 0);
      setLiked(likesData?.some(l => l.user_id === user?.id) || false);

      setLoading(false);
    } catch (error: any) {
      console.error("Error loading post:", error);
      toast.error("Failed to load post");
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!currentUserId) {
      toast.error("You must be logged in");
      return;
    }

    try {
      if (liked) {
        await supabase
          .from("likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", currentUserId);
        setLiked(false);
        setLikesCount(prev => prev - 1);
      } else {
        await supabase
          .from("likes")
          .insert({ post_id: postId, user_id: currentUserId });
        setLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (error: any) {
      console.error("Error toggling like:", error);
      toast.error("Failed to update like");
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUserId) return;

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from("comments")
        .insert({
          post_id: postId,
          user_id: currentUserId,
          content: newComment.trim(),
        });

      if (error) throw error;

      setNewComment("");
      await loadPostAndComments();
      toast.success("Comment posted!");
    } catch (error: any) {
      console.error("Error posting comment:", error);
      toast.error("Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Post not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="max-w-screen-lg mx-auto px-4 h-16 flex items-center">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="ml-4 text-xl font-bold">Post</h1>
        </div>
      </header>

      <main className="max-w-screen-lg mx-auto">
        {/* Post */}
        <div className="border-b border-border p-4">
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
                <span className="font-semibold">{post.profiles?.username || "Unknown"}</span>
                <span className="text-sm text-muted-foreground">
                  · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </span>
              </div>

              {post.content && <p className="mt-2 whitespace-pre-wrap">{post.content}</p>}

              {post.media_url && (
                <div className="mt-3 rounded-lg overflow-hidden">
                  {post.media_type === "image" ? (
                    <img src={post.media_url} alt="Post media" className="w-full" />
                  ) : (
                    <video src={post.media_url} controls className="w-full" />
                  )}
                </div>
              )}

              <div className="flex items-center gap-4 mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  onClick={handleLike}
                >
                  <Heart className={`w-5 h-5 ${liked ? "fill-[hsl(340,82%,52%)] text-[hsl(340,82%,52%)]" : ""}`} />
                  {likesCount > 0 && <span>{likesCount}</span>}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Comments */}
        <div className="divide-y divide-border">
          {comments.map(comment => (
            <div key={comment.id} className="p-4 flex gap-3">
              <Avatar className="w-8 h-8">
                <AvatarImage src={comment.profiles?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-r from-[hsl(291,64%,42%)] via-[hsl(340,82%,52%)] to-[hsl(25,95%,53%)] text-white text-xs">
                  {comment.profiles?.username?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{comment.profiles?.username || "Unknown"}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm mt-1">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Comment Input */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border">
        <form onSubmit={handleSubmitComment} className="max-w-screen-lg mx-auto p-4 flex gap-2">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            disabled={submitting}
          />
          <Button type="submit" disabled={submitting || !newComment.trim()}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default PostDetail;
