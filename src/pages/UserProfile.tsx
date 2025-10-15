import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import PostCard from "@/components/PostCard";

interface Profile {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  bio: string;
}

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

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [likes, setLikes] = useState<Record<string, { count: number; isLiked: boolean }>>({});
  const [comments, setComments] = useState<Record<string, number>>({});
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    loadUserProfile();
  }, [userId]);

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;

      if (postsData && postsData.length > 0) {
        const postsWithProfiles = postsData.map(post => ({
          ...post,
          profiles: {
            username: profileData.username,
            avatar_url: profileData.avatar_url
          }
        }));
        setPosts(postsWithProfiles);
      }

      if (postsData && user) {
        const postIds = postsData.map(p => p.id);

        const { data: likesData } = await supabase
          .from("likes")
          .select("post_id, user_id")
          .in("post_id", postIds);

        const { data: commentsData } = await supabase
          .from("comments")
          .select("post_id")
          .in("post_id", postIds);

        const likesMap: Record<string, { count: number; isLiked: boolean }> = {};
        postsData.forEach(post => {
          const postLikes = likesData?.filter(l => l.post_id === post.id) || [];
          likesMap[post.id] = {
            count: postLikes.length,
            isLiked: postLikes.some(l => l.user_id === user.id)
          };
        });
        setLikes(likesMap);

        const commentsMap: Record<string, number> = {};
        postsData.forEach(post => {
          commentsMap[post.id] = commentsData?.filter(c => c.post_id === post.id).length || 0;
        });
        setComments(commentsMap);
      }

      // Load follow status and counts
      if (user) {
        const { data: followData } = await supabase
          .from("follows")
          .select("*")
          .eq("follower_id", user.id)
          .eq("following_id", userId)
          .single();

        setIsFollowing(!!followData);

        const { count: followersCount } = await supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", userId);

        const { count: followingCount } = await supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", userId);

        setFollowersCount(followersCount || 0);
        setFollowingCount(followingCount || 0);
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUserId) {
      toast.error("You must be logged in to follow");
      return;
    }

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", userId);

        if (error) throw error;
        setIsFollowing(false);
        setFollowersCount(prev => prev - 1);
        toast.success("Unfollowed");
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({
            follower_id: currentUserId,
            following_id: userId,
          });

        if (error) throw error;
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
        toast.success("Following");
      }
    } catch (error: any) {
      console.error("Error toggling follow:", error);
      toast.error("Failed to update follow status");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-[hsl(291,64%,42%)] via-[hsl(340,82%,52%)] to-[hsl(25,95%,53%)] animate-pulse" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Profile not found</p>
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
          <h1 className="ml-4 text-xl font-semibold">{profile.username}</h1>
        </div>
      </header>

      <main className="max-w-screen-lg mx-auto">
        <div className="p-6 border-b border-border">
          <div className="flex items-start gap-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={profile.avatar_url} />
              <AvatarFallback className="bg-gradient-to-r from-[hsl(291,64%,42%)] via-[hsl(340,82%,52%)] to-[hsl(25,95%,53%)] text-white text-2xl">
                {profile.username?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">{profile.username}</h2>
                {currentUserId && currentUserId !== userId && (
                  <div className="flex gap-2">
                    <Button
                      variant={isFollowing ? "outline" : "default"}
                      onClick={handleFollow}
                    >
                      {isFollowing ? "Unfollow" : "Follow"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/messages?user=${userId}`)}
                    >
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              {profile.full_name && (
                <p className="text-muted-foreground">{profile.full_name}</p>
              )}
              {profile.bio && (
                <p className="mt-3 text-foreground">{profile.bio}</p>
              )}
              <div className="flex gap-6 mt-3 text-sm">
                <div>
                  <span className="font-semibold">{posts.length}</span>{" "}
                  <span className="text-muted-foreground">posts</span>
                </div>
                <div>
                  <span className="font-semibold">{followersCount}</span>{" "}
                  <span className="text-muted-foreground">followers</span>
                </div>
                <div>
                  <span className="font-semibold">{followingCount}</span>{" "}
                  <span className="text-muted-foreground">following</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Posts Grid */}
        <div className="p-6">
          <div className="flex items-center gap-6 mb-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="font-semibold">{posts.length}</span>
              <span className="text-muted-foreground">posts</span>
            </div>
          </div>

          {posts.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No posts yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {posts.map(post => (
                <div
                  key={post.id}
                  onClick={() => navigate(`/post/${post.id}`)}
                  className="relative aspect-square bg-muted cursor-pointer hover:opacity-80 transition-opacity"
                >
                  {post.media_url ? (
                    post.media_type === "image" ? (
                      <img
                        src={post.media_url}
                        alt="Post"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={post.media_url}
                        className="w-full h-full object-cover"
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary">
                      <p className="text-xs text-center p-2 line-clamp-3">{post.content}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default UserProfile;
