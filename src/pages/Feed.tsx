import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Home, Search, PlusSquare, MessageCircle, User as UserIcon, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import PostCard from "@/components/PostCard";
import StoriesBar from "@/components/StoriesBar";
import StoryViewer from "@/components/StoryViewer";

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

const Feed = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [likes, setLikes] = useState<Record<string, { count: number; isLiked: boolean }>>({});
  const [comments, setComments] = useState<Record<string, number>>({});
  const [viewingStories, setViewingStories] = useState<any[]>([]);
  const [storyIndex, setStoryIndex] = useState(0);
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
        loadPosts(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadPosts = async (userId: string) => {
    try {
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;

      if (postsData && postsData.length > 0) {
        const userIds = [...new Set(postsData.map(p => p.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, username, avatar_url")
          .in("user_id", userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]));
        
        const postsWithProfiles = postsData.map(post => ({
          ...post,
          profiles: profilesMap.get(post.user_id)
        }));

        setPosts(postsWithProfiles);

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
            isLiked: postLikes.some(l => l.user_id === userId)
          };
        });
        setLikes(likesMap);

        const commentsMap: Record<string, number> = {};
        postsData.forEach(post => {
          commentsMap[post.id] = commentsData?.filter(c => c.post_id === post.id).length || 0;
        });
        setComments(commentsMap);
      }
    } catch (error: any) {
      console.error("Error loading posts:", error);
      toast.error("Failed to load posts");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const handleViewStory = async (userId: string) => {
    const { data: stories } = await supabase
      .from("stories")
      .select("*")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });

    if (stories && stories.length > 0) {
      const userIds = [userId];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .in("user_id", userIds);

      const profile = profilesData?.[0];
      const storiesWithProfile = stories.map(s => ({ ...s, profiles: profile }));
      
      setViewingStories(storiesWithProfile);
      setStoryIndex(0);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-[hsl(291,64%,42%)] via-[hsl(340,82%,52%)] to-[hsl(25,95%,53%)] animate-pulse mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="max-w-screen-lg mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[hsl(291,64%,42%)] via-[hsl(340,82%,52%)] to-[hsl(25,95%,53%)] bg-clip-text text-transparent">
            TimePass
          </h1>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Stories */}
      <StoriesBar
        currentUserId={user?.id}
        onCreateStory={() => navigate("/create-story")}
        onViewStory={handleViewStory}
      />

      {/* Main Content */}
      <main className="max-w-screen-lg mx-auto pb-20">
        {posts.length === 0 ? (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-2">Welcome to Your Feed</h2>
            <p className="text-muted-foreground">Be the first to create a post!</p>
          </div>
        ) : (
          posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              likesCount={likes[post.id]?.count || 0}
              commentsCount={comments[post.id] || 0}
              isLiked={likes[post.id]?.isLiked || false}
              currentUserId={user?.id}
            />
          ))
        )}
      </main>

      {/* Story Viewer */}
      {viewingStories.length > 0 && (
        <StoryViewer
          stories={viewingStories}
          initialIndex={storyIndex}
          onClose={() => setViewingStories([])}
        />
      )}

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
          <Button variant="ghost" size="icon" onClick={() => navigate("/profile-view")}>
            <UserIcon className="w-6 h-6" />
          </Button>
        </div>
      </nav>
    </div>
  );
};

export default Feed;