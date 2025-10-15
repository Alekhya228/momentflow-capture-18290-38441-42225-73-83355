import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, Heart, MessageCircle, Share2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/feed");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          navigate("/feed");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(291,64%,42%)]/10 via-[hsl(340,82%,52%)]/10 to-[hsl(25,95%,53%)]/10" />
        
        <div className="relative z-10 max-w-6xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-r from-[hsl(291,64%,42%)] via-[hsl(340,82%,52%)] to-[hsl(25,95%,53%)] mb-8 animate-[scale-in_0.5s_ease-out]">
            <Camera className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-6xl md:text-7xl font-bold mb-6 animate-[fade-in_0.6s_ease-out]">
            Welcome to{" "}
            <span className="bg-gradient-to-r from-[hsl(291,64%,42%)] via-[hsl(340,82%,52%)] to-[hsl(25,95%,53%)] bg-clip-text text-transparent">
              TimePass
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto animate-[fade-in_0.8s_ease-out]">
            Share your moments. Connect with friends. Discover the world through stunning photos and videos.
          </p>
          
          <div className="flex gap-4 justify-center animate-[fade-in_1s_ease-out]">
            <Button 
              variant="gradient" 
              size="lg" 
              onClick={() => navigate("/auth")}
              className="text-lg px-8"
            >
              Get Started
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => navigate("/auth")}
              className="text-lg px-8"
            >
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">
            Everything you need to share your story
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-card border border-border hover:shadow-lg transition-all duration-200">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-[hsl(291,64%,42%)] to-[hsl(340,82%,52%)] flex items-center justify-center mb-4">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Share Moments</h3>
              <p className="text-muted-foreground">
                Post photos and videos that capture your special moments with beautiful filters and effects.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-card border border-border hover:shadow-lg transition-all duration-200">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-[hsl(340,82%,52%)] to-[hsl(25,95%,53%)] flex items-center justify-center mb-4">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Connect & Chat</h3>
              <p className="text-muted-foreground">
                Stay in touch with friends through direct messages, comments, and real-time interactions.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-card border border-border hover:shadow-lg transition-all duration-200">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-[hsl(25,95%,53%)] to-[hsl(291,64%,42%)] flex items-center justify-center mb-4">
                <Share2 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Discover More</h3>
              <p className="text-muted-foreground">
                Explore trending content, follow your interests, and discover new creators from around the world.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4">
        <div className="max-w-6xl mx-auto text-center text-muted-foreground">
          <p>&copy; 2025 TimePass. Built with Lovable Cloud.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;