import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, Heart, Check, CheckCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Conversation {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  updated_at: string;
  other_user: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
    is_active: boolean;
    last_active: string | null;
  };
  last_message: Message | null;
  unread_count: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read: boolean;
  reacted: boolean;
  delivered_at?: string;
  seen_at?: string;
}

// Define the database schema type
interface DbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read: boolean;
  reacted: boolean;
  delivered_at?: string;
  seen_at?: string;
}

// Add this type to define the update payload
type MessageUpdate = {
  reacted?: boolean;
  delivered_at?: string;
  seen_at?: string;
  read?: boolean;
}

const Messages = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadConversations();
    }
  }, [currentUserId]);

  useEffect(() => {
    const userId = searchParams.get('user');
    if (userId && currentUserId) {
      findOrCreateConversation(userId);
    }
  }, [searchParams, currentUserId]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages();
      const channel = supabase
        .channel(`messages-${selectedConversation}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedConversation}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setMessages((prev) => [...prev, payload.new as Message]);
              scrollToBottom();
            } else if (payload.eventType === 'UPDATE') {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === (payload.new as Message).id ? (payload.new as Message) : msg
                )
              );
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_1_id.eq.${currentUserId},participant_2_id.eq.${currentUserId}`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const conversationsWithUsers = await Promise.all(
        data.map(async (conv) => {
          const otherUserId = conv.participant_1_id === currentUserId 
            ? conv.participant_2_id 
            : conv.participant_1_id;

          const [profileResponse, lastMessageResponse, unreadCountResponse] = await Promise.all([
            supabase
              .from('profiles')
              .select('id, username, full_name, avatar_url')
              .eq('user_id', otherUserId)
              .single(),
            supabase
              .from('messages')
              .select('id, conversation_id, sender_id, content, created_at, read')
              .eq('conversation_id', conv.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single(),
            supabase
              .from('messages')
              .select('id', { count: 'exact' })
              .eq('conversation_id', conv.id)
              .eq('sender_id', otherUserId)
              .is('seen_at', null)
          ]);

          const profile = profileResponse.data;
          const lastMessage = lastMessageResponse.data;
          const unreadCount = unreadCountResponse.count || 0;

          return {
            ...conv,
            other_user: {
              ...(profile || { id: otherUserId, username: 'Unknown', full_name: 'Unknown User', avatar_url: '' }),
              is_active: false,
              last_active: null
            },
            last_message: lastMessage ? {
              ...lastMessage,
              reacted: false,
              delivered_at: null,
              seen_at: null
            } : null,
            unread_count: unreadCount
          };
        })
      );

      setConversations(conversationsWithUsers);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const findOrCreateConversation = async (otherUserId: string) => {
    try {
      // Check if conversation exists (in either direction)
      const { data: existing } = await supabase
        .from('conversations')
        .select('*')
        .or(`and(participant_1_id.eq.${currentUserId},participant_2_id.eq.${otherUserId}),and(participant_1_id.eq.${otherUserId},participant_2_id.eq.${currentUserId})`)
        .maybeSingle();

      if (existing) {
        setSelectedConversation(existing.id);
        return;
      }

      // Check if users are mutual followers before creating conversation
      const { data: followingThem } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', currentUserId)
        .eq('following_id', otherUserId)
        .maybeSingle();

      const { data: followingMe } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', otherUserId)
        .eq('following_id', currentUserId)
        .maybeSingle();

      if (!followingThem || !followingMe) {
        toast({
          title: 'Cannot start conversation',
          description: 'You can only message users you both follow',
          variant: 'destructive',
        });
        navigate('/feed');
        return;
      }

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          participant_1_id: currentUserId,
          participant_2_id: otherUserId,
        })
        .select()
        .single();

      if (error) {
        // If error is RLS related, show friendly message
        if (error.message.includes('row-level security')) {
          toast({
            title: 'Cannot start conversation',
            description: 'You can only message mutual followers',
            variant: 'destructive',
          });
          navigate('/feed');
          return;
        }
        throw error;
      }

      setSelectedConversation(newConv.id);
      loadConversations();
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to start conversation',
        variant: 'destructive',
      });
    }
  };

  const loadMessages = async () => {
    if (!selectedConversation) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, created_at, read')
        .eq('conversation_id', selectedConversation)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Transform the data to include default values for missing fields
      const transformedMessages = (data || []).map(msg => ({
        ...msg,
        reacted: false,
        delivered_at: null,
        seen_at: null
      }));
      
      setMessages(transformedMessages);
      
      // Mark messages as read since we don't have delivered/seen status yet
      const unreadMessages = data?.filter(
        msg => msg.sender_id !== currentUserId && !msg.read
      ) || [];
      
      if (unreadMessages.length > 0) {
        await supabase
          .from('messages')
          .update({ read: true })
          .in('id', unreadMessages.map(msg => msg.id));
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleReaction = async (messageId: string) => {
    // Reactions feature is disabled until database migration is applied
    console.warn('Message reactions are not yet available');
  };

  const updateLastSeen = async () => {
    if (!selectedConversation) return;

    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select('participant_1_id, participant_2_id')
        .eq('id', selectedConversation)
        .single();

      // Mark messages as read since we don't have seen status yet
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('conversation_id', selectedConversation)
        .eq('sender_id', conv.participant_1_id === currentUserId ? conv.participant_2_id : conv.participant_1_id)
        .eq('read', false);
    } catch (error) {
      console.error('Error updating read status:', error);
    }
  };

  const handleConversationClick = (convId: string) => {
    setSelectedConversation(convId);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation,
          sender_id: currentUserId,
          content: newMessage.trim(),
        });

      if (error) throw error;

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation);

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    }
  };

  const selectedConvData = conversations.find(c => c.id === selectedConversation);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/feed')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Messages</h1>
        </div>
      </header>

      <div className="container mx-auto flex h-[calc(100vh-73px)]">
        {/* Conversations List */}
        <div className={`w-full md:w-1/3 border-r ${selectedConversation ? 'hidden md:block' : ''}`}>
          <ScrollArea className="h-full">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>No conversations yet</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleConversationClick(conv.id)}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b ${
                    selectedConversation === conv.id ? 'bg-muted' : ''
                  }`}
                >
                  <div className="relative">
                    <Avatar>
                      <AvatarImage src={conv.other_user.avatar_url} />
                      <AvatarFallback>{conv.other_user.username?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {conv.other_user.is_active && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{conv.other_user.username}</p>
                      {conv.unread_count > 0 && (
                        <Badge variant="secondary" className="rounded-full">
                          {conv.unread_count}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{conv.other_user.full_name}</p>
                    {conv.last_message && (
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {conv.last_message.sender_id === currentUserId ? 'You: ' : ''}{conv.last_message.content}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </div>

        {/* Messages Area */}
        <div className={`flex-1 flex flex-col ${!selectedConversation ? 'hidden md:flex' : ''}`}>
          {selectedConversation && selectedConvData ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Avatar>
                  <AvatarImage src={selectedConvData.other_user.avatar_url} />
                  <AvatarFallback>{selectedConvData.other_user.username?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{selectedConvData.other_user.username}</p>
                  <p className="text-sm text-muted-foreground">{selectedConvData.other_user.full_name}</p>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4" ref={messagesEndRef}>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`group mb-4 flex ${message.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="flex flex-col items-end">
                      <div
                        className={`relative max-w-[70%] rounded-2xl px-4 py-2 ${
                          message.sender_id === currentUserId
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                        onDoubleClick={() => message.sender_id !== currentUserId && handleReaction(message.id)}
                      >
                        <p className="break-words">{message.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs opacity-70">
                            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {message.sender_id === currentUserId && message.read && (
                            <span className="text-xs">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1"
                  />
                  <Button onClick={sendMessage} size="icon" disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
