import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  created_at: string;
  profiles?: {
    username: string;
    avatar_url: string;
  };
}

interface StoriesBarProps {
  currentUserId: string | undefined;
  onCreateStory: () => void;
  onViewStory: (userId: string) => void;
}

const StoriesBar = ({ currentUserId, onCreateStory, onViewStory }: StoriesBarProps) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [userStories, setUserStories] = useState<Map<string, Story[]>>(new Map());
  const navigate = useNavigate();

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    try {
      const { data: storiesData, error } = await supabase
        .from("stories")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (storiesData && storiesData.length > 0) {
        const userIds = [...new Set(storiesData.map((s: any) => s.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, username, avatar_url")
          .in("user_id", userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]));
        
        const storiesWithProfiles = storiesData.map(story => ({
          ...story,
          profiles: profilesMap.get(story.user_id)
        }));

        setStories(storiesWithProfiles);

        // Group stories by user
        const grouped = new Map<string, Story[]>();
        storiesWithProfiles.forEach(story => {
          const existing = grouped.get(story.user_id) || [];
          grouped.set(story.user_id, [...existing, story]);
        });
        setUserStories(grouped);
      }
    } catch (error: any) {
      console.error("Error loading stories:", error);
    }
  };

  const uniqueUsers = Array.from(userStories.keys());

  return (
    <ScrollArea className="w-full border-b border-border">
      <div className="flex gap-4 p-4">
        {/* Create Story Button */}
        <div className="flex flex-col items-center gap-1 min-w-[70px]">
          <button
            onClick={onCreateStory}
            className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-muted hover:border-primary transition-colors"
          >
            {currentUserId && (
              <Avatar className="w-full h-full">
                <AvatarImage src="" />
                <AvatarFallback className="bg-secondary">
                  <Plus className="w-6 h-6" />
                </AvatarFallback>
              </Avatar>
            )}
          </button>
          <span className="text-xs text-center">Your Story</span>
        </div>

        {/* User Stories */}
        {uniqueUsers.map((userId) => {
          const userStoriesData = userStories.get(userId) || [];
          const firstStory = userStoriesData[0];
          const profile = firstStory.profiles;
          
          return (
            <div key={userId} className="flex flex-col items-center gap-1 min-w-[70px]">
              <button
                onClick={() => onViewStory(userId)}
                className="relative"
              >
                <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-[hsl(25,95%,53%)] via-[hsl(340,82%,52%)] to-[hsl(291,64%,42%)]">
                  <Avatar className="w-full h-full border-2 border-background">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="bg-gradient-to-r from-[hsl(291,64%,42%)] via-[hsl(340,82%,52%)] to-[hsl(25,95%,53%)] text-white">
                      {profile?.username?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </button>
              <span className="text-xs text-center truncate max-w-[70px]">
                {profile?.username || "User"}
              </span>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};

export default StoriesBar;
