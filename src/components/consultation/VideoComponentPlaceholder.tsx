"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";

type VideoComponentPlaceholderProps = {
  roomName: string;
  token: string; // Would be used by Twilio SDK
  identity: string;
  isHost: boolean;
};

// Mock participants
const mockParticipants = [
  { id: 'user1', name: 'Dr. Smith', isHost: true },
  { id: 'user2', name: 'Patient Zero', isHost: false },
  { id: 'user3', name: 'Specialist Lee', isHost: false },
];

export function VideoComponentPlaceholder({ roomName, token, identity, isHost }: VideoComponentPlaceholderProps) {
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVidOff, setIsVidOff] = useState(false);
  const [participants, setParticipants] = useState(mockParticipants); // In real app, this comes from Twilio

  // Simulate current user joining
  useEffect(() => {
    // Ensure current user is in participants list or add them
    if (!participants.find(p => p.name === identity)) {
      setParticipants(prev => [...prev, { id: Date.now().toString(), name: identity, isHost }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, isHost]);


  return (
    <Card className="w-full min-h-[400px] flex flex-col shadow-lg">
      <CardHeader className="bg-muted/50 p-4 border-b">
        <CardTitle className="text-lg">Video Consultation: {roomName}</CardTitle>
        <CardDescription>You are in the call as: <Badge variant={isHost ? "default" : "secondary"}>{identity} {isHost ? "(Host)" : "(Client)"}</Badge></CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-auto bg-background">
        {/* Main video area (e.g., active speaker or self-view) */}
        <div className="md:col-span-2 rounded-lg bg-foreground/10 flex items-center justify-center aspect-video relative overflow-hidden">
          <Image src="https://placehold.co/600x338" alt="Main video feed" layout="fill" objectFit="cover" data-ai-hint="video conference" />
          <Badge className="absolute bottom-2 left-2">{identity} (You)</Badge>
        </div>

        {/* Participant thumbnails */}
        {participants.filter(p => p.name !== identity).map((participant) => (
          <div key={participant.id} className="rounded-lg bg-foreground/5 flex items-center justify-center aspect-video relative overflow-hidden">
             <Image src={`https://placehold.co/300x168?text=${participant.name.charAt(0)}`} alt={`${participant.name}'s video feed`} layout="fill" objectFit="cover" data-ai-hint="person portrait" />
            <Badge className="absolute bottom-2 left-2">{participant.name} {participant.isHost ? "(Host)" : ""}</Badge>
          </div>
        ))}
        {participants.length === 1 && (
          <div className="rounded-lg bg-muted flex items-center justify-center aspect-video">
            <p className="text-muted-foreground">Waiting for others to join...</p>
          </div>
        )}
      </CardContent>
      <div className="p-4 border-t bg-muted/50 flex justify-center items-center space-x-2 md:space-x-4">
        <Button variant="outline" size="icon" onClick={() => setIsMicMuted(!isMicMuted)} aria-label={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}>
          {isMicMuted ? <MicOff /> : <Mic />}
        </Button>
        <Button variant="outline" size="icon" onClick={() => setIsVidOff(!isVidOff)} aria-label={isVidOff ? "Start Video" : "Stop Video"}>
          {isVidOff ? <VideoOff /> : <Video />}
        </Button>
        <Button variant="outline" size="icon" aria-label="Show Participants">
          <Users />
        </Button>
        <Button variant="outline" size="icon" aria-label="Open Chat (Optional)">
          <MessageSquare />
        </Button>
        <Button variant="destructive" size="icon" aria-label="Leave Call">
          <PhoneOff />
        </Button>
      </div>
    </Card>
  );
}
