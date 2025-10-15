import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Home, Search, PlusSquare, MessageCircle, User as UserIcon, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

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
}

const ProfileView = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (!session?.user) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      } else {
        loadProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      setProfile(data);

      // Load user's posts
      const { data: postsData } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (postsData) {
        setPosts(postsData);
      }

      // Load follower/following counts
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
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-[hsl(291,64%,42%)] via-[hsl(340,82%,52%)] to-[hsl(25,95%,53%)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="max-w-screen-lg mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{profile?.username}</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Profile Info */}
      <main className="max-w-screen-lg mx-auto pb-20">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-6 mb-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="bg-gradient-to-r from-[hsl(291,64%,42%)] via-[hsl(340,82%,52%)] to-[hsl(25,95%,53%)] text-white text-2xl">
                {profile?.username?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex gap-8 mb-2">
                <div className="text-center">
                  <div className="font-semibold">{posts.length}</div>
                  <div className="text-sm text-muted-foreground">posts</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold">{followersCount}</div>
                  <div className="text-sm text-muted-foreground">followers</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold">{followingCount}</div>
                  <div className="text-sm text-muted-foreground">following</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="font-semibold">{profile?.full_name}</h2>
            {profile?.bio && (
              <p className="text-sm text-foreground whitespace-pre-wrap">{profile.bio}</p>
            )}
          </div>

          <Button 
            variant="outline" 
            className="w-full mt-4"
            onClick={() => navigate("/profile")}
          >
            Edit Profile
          </Button>
        </div>

        {/* Posts Grid */}
        <div className="border-t border-border">
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

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border">
        <div className="max-w-screen-lg mx-auto px-4 h-16 flex items-center justify-around">
          <Button variant="ghost" size="icon" onClick={() => navigate("/feed")}>
            <Home className="w-6 h-6" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate("/search")}>
            <Search className="w-6 h-6" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate("/create-post")}>
            <PlusSquare className="w-6 h-6" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate("/messages")}>
            <MessageCircle className="w-6 h-6" />
          </Button>
          <Button variant="ghost" size="icon">
            <UserIcon className="w-6 h-6 fill-primary" />
          </Button>
        </div>
      </nav>
    </div>
  );
};

export default ProfileView;
