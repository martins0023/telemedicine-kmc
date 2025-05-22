
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, MessageSquare, Loader2, CameraOff } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { connect, createLocalVideoTrack, Room, LocalTrack, LocalVideoTrack, RemoteParticipant, RemoteTrack, RemoteTrackPublication } from 'twilio-video';
import { useToast } from "@/hooks/use-toast";

type VideoComponentPlaceholderProps = {
  roomName: string;
  token: string;
  identity: string;
  isHost: boolean;
  onLeaveCall?: () => void; // Callback when user leaves the call
};

export function VideoComponentPlaceholder({ roomName, token, identity, isHost, onLeaveCall }: VideoComponentPlaceholderProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map());
  
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVidOff, setIsVidOff] = useState(true); // Start with video off initially
  const [isConnecting, setIsConnecting] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const cleanupTracks = useCallback(() => {
    if (localVideoTrack) {
      localVideoTrack.stop();
      setLocalVideoTrack(null);
    }
    room?.localParticipant.tracks.forEach(publication => {
      publication.track.stop();
      room.localParticipant.unpublishTrack(publication.track);
    });
  }, [localVideoTrack, room]);

  useEffect(() => {
    const getCameraPermissionAndSetup = async () => {
      try {
        // Check for MediaDevices support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          toast({ variant: 'destructive', title: 'Unsupported Browser', description: 'Your browser does not support camera access.' });
          setHasCameraPermission(false);
          setIsConnecting(false);
          return;
        }
        // Request permission
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        // Stop the tracks immediately as Twilio will create its own
        stream.getTracks().forEach(track => track.stop());
        setHasCameraPermission(true);
        setIsVidOff(false); // If permission granted, turn video on by default
      } catch (error) {
        console.error('Error accessing camera/microphone:', error);
        setHasCameraPermission(false);
        setIsVidOff(true);
        toast({
          variant: 'destructive',
          title: 'Media Access Denied',
          description: 'Please enable camera and microphone permissions in your browser settings.',
        });
      }
    };
    getCameraPermissionAndSetup();
  }, [toast]);


  useEffect(() => {
    if (token && roomName && hasCameraPermission !== null) { // Only connect if token, roomName, and permission status is known
      setIsConnecting(true);
      connect(token, {
        name: roomName,
        audio: true,
        video: hasCameraPermission ? { width: 640 } : false, // Only request video if permission was granted
      }).then(async (connectedRoom) => {
        setRoom(connectedRoom);
        setIsConnecting(false);

        // Attach local video if permission was granted and track exists
        if (hasCameraPermission) {
            try {
                const videoTrack = await createLocalVideoTrack({ width: 640 });
                setLocalVideoTrack(videoTrack);
                if (localVideoRef.current) {
                    videoTrack.attach(localVideoRef.current);
                }
                connectedRoom.localParticipant.publishTrack(videoTrack);
            } catch (e) {
                console.error("Failed to create or publish local video track:", e);
                toast({ variant: "destructive", title: "Video Error", description: "Could not start your video."});
                setIsVidOff(true);
            }
        }


        // Handle existing participants
        const newRemoteParticipants = new Map(remoteParticipants);
        connectedRoom.participants.forEach(participant => {
          newRemoteParticipants.set(participant.sid, participant);
        });
        setRemoteParticipants(newRemoteParticipants);

        // Participant connected
        connectedRoom.on('participantConnected', (participant) => {
          console.log(\`Participant connected: \${participant.identity}\`);
          setRemoteParticipants(prev => new Map(prev).set(participant.sid, participant));
        });

        // Participant disconnected
        connectedRoom.on('participantDisconnected', (participant) => {
          console.log(\`Participant disconnected: \${participant.identity}\`);
          setRemoteParticipants(prev => {
            const newMap = new Map(prev);
            newMap.delete(participant.sid);
            return newMap;
          });
          // Clean up video elements for this participant
          const videoElement = document.getElementById(\`remote-video-\${participant.sid}\`);
          if (videoElement) videoElement.remove();
          const audioElement = document.getElementById(\`remote-audio-\${participant.sid}\`);
          if (audioElement) audioElement.remove();
        });
        
        // Handle tracks for remote participants
        connectedRoom.participants.forEach(participant => {
          participant.on('trackSubscribed', track => handleTrackSubscribed(track, participant));
          participant.on('trackUnsubscribed', track => handleTrackUnsubscribed(track, participant));
          participant.tracks.forEach(publication => {
            if (publication.isSubscribed && publication.track) {
              handleTrackSubscribed(publication.track, participant);
            }
          });
        });
        connectedRoom.on('participantConnected', participant => {
            participant.on('trackSubscribed', track => handleTrackSubscribed(track, participant));
            participant.on('trackUnsubscribed', track => handleTrackUnsubscribed(track, participant));
        });


      }).catch(error => {
        console.error('Could not connect to Twilio:', error);
        toast({ variant: "destructive", title: "Connection Failed", description: \`Could not connect to the room: \${error.message}\` });
        setIsConnecting(false);
      });

      return () => {
        cleanupTracks();
        if (room) {
          room.disconnect();
          setRoom(null);
        }
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, roomName, hasCameraPermission, toast]); // Removed cleanupTracks and room from deps to avoid cycle, handle cleanup explicitly.

  const handleTrackSubscribed = (track: RemoteTrack, participant: RemoteParticipant) => {
    const elementId = \`\${track.kind}-\${participant.sid}\`;
    let element = document.getElementById(elementId) as HTMLVideoElement | HTMLAudioElement | null;

    if (!element) {
      element = track.attach();
      element.id = elementId;
      
      const participantContainerId = \`participant-\${participant.sid}\`;
      let participantContainer = document.getElementById(participantContainerId);
      
      if (!participantContainer && remoteVideosRef.current) {
          participantContainer = document.createElement('div');
          participantContainer.id = participantContainerId;
          participantContainer.className = "rounded-lg bg-foreground/5 flex flex-col items-center justify-center aspect-video relative overflow-hidden p-1";
          
          const nameBadge = document.createElement('span');
          nameBadge.className = "absolute bottom-1 left-1 text-xs bg-black/50 text-white px-1 rounded";
          nameBadge.innerText = participant.identity;
          participantContainer.appendChild(nameBadge);
          
          remoteVideosRef.current.appendChild(participantContainer);
      }
      
      if (participantContainer && element.tagName.toLowerCase() === 'video') {
        element.style.width = '100%';
        element.style.height = '100%';
        element.style.objectFit = 'cover';
        participantContainer.prepend(element); // Prepend to show video first
      } else if (participantContainer) {
        // Audio elements are not visible, just attach them
        participantContainer.appendChild(element);
      }
    }
  };

  const handleTrackUnsubscribed = (track: RemoteTrack, participant: RemoteParticipant) => {
    track.detach().forEach(element => element.remove());
    const participantContainer = document.getElementById(\`participant-\${participant.sid}\`);
    // If no more video tracks for this participant, remove the container
    let hasVideo = false;
    participant.videoTracks.forEach(pub => { if(pub.isTrackSubscribed) hasVideo = true; });
    if (!hasVideo && participantContainer && !participantContainer.querySelector('video')) {
        participantContainer.remove();
    }
  };

  const handleLeaveRoom = () => {
    cleanupTracks();
    if (room) {
      room.disconnect();
      setRoom(null);
    }
    if (onLeaveCall) {
      onLeaveCall();
    }
  };

  const toggleMute = () => {
    if (!room) return;
    const localAudioTrack = Array.from(room.localParticipant.audioTracks.values())[0]?.track;
    if (localAudioTrack) {
      if (localAudioTrack.isEnabled) {
        localAudioTrack.disable();
        setIsMicMuted(true);
      } else {
        localAudioTrack.enable();
        setIsMicMuted(false);
      }
    }
  };

 const toggleVideo = async () => {
    if (!room || hasCameraPermission === false) {
        if(hasCameraPermission === false) {
             toast({ variant: "destructive", title: "Camera Disabled", description: "Camera permission is not granted."});
        }
        return;
    }

    const currentVideoTrack = localVideoTrack;

    if (currentVideoTrack && !isVidOff) { // Video is ON, turn it OFF
      currentVideoTrack.stop();
      room.localParticipant.unpublishTrack(currentVideoTrack);
      setLocalVideoTrack(null);
      setIsVidOff(true);
      if (localVideoRef.current) { // Clear the srcObject
          localVideoRef.current.srcObject = null;
      }
    } else { // Video is OFF, turn it ON
      try {
        const newVideoTrack = await createLocalVideoTrack({ width: 640 });
        setLocalVideoTrack(newVideoTrack);
        if (localVideoRef.current) {
          newVideoTrack.attach(localVideoRef.current);
        }
        await room.localParticipant.publishTrack(newVideoTrack);
        setIsVidOff(false);
      } catch (e) {
        console.error("Failed to create or publish local video track:", e);
        toast({ variant: "destructive", title: "Video Error", description: "Could not start your video."});
        setIsVidOff(true);
      }
    }
  };


  if (isConnecting && hasCameraPermission === null) {
    return (
      <Card className="w-full min-h-[400px] flex flex-col shadow-lg items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Requesting media permissions...</p>
      </Card>
    );
  }
  
  if (isConnecting) {
    return (
      <Card className="w-full min-h-[400px] flex flex-col shadow-lg items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Connecting to consultation...</p>
      </Card>
    );
  }


  return (
    <Card className="w-full min-h-[500px] flex flex-col shadow-lg">
      <CardHeader className="bg-muted/50 p-3 md:p-4 border-b">
        <CardTitle className="text-md md:text-lg">Video Consultation: {roomName}</CardTitle>
        <CardDescription className="text-xs md:text-sm">You are: <Badge variant={isHost ? "default" : "secondary"}>{identity}</Badge></CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 p-2 md:p-4 grid grid-cols-1 md:grid-rows-[auto_1fr] gap-2 md:gap-4 overflow-auto bg-background">
        {/* Local video area */}
        <div className="md:row-start-1 md:col-start-1 rounded-lg bg-foreground/10 flex items-center justify-center aspect-video relative overflow-hidden min-h-[150px]">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {isVidOff && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                <CameraOff size={48} className="text-white/70" />
                <p className="text-white/70 text-sm mt-2">Your video is off</p>
            </div>
          )}
          <Badge className="absolute bottom-2 left-2 text-xs">{identity} (You)</Badge>
        </div>
        
        {/* Remote participants grid */}
        <div ref={remoteVideosRef} className="md:row-start-2 md:col-start-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
          {/* Remote videos will be appended here by handleTrackSubscribed */}
          {Array.from(remoteParticipants.values()).length === 0 && !isConnecting && (
             <div className="col-span-full flex items-center justify-center text-muted-foreground h-full min-h-[100px]">
                Waiting for others to join...
            </div>
          )}
        </div>

         {hasCameraPermission === false && (
            <Alert variant="destructive" className="md:row-start-3 md:col-span-full mt-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Camera/Microphone Access Denied</AlertTitle>
              <AlertDescription>
                Video and audio sharing is disabled. Please enable permissions in your browser settings and refresh.
              </AlertDescription>
            </Alert>
          )}

      </CardContent>
      <div className="p-3 md:p-4 border-t bg-muted/50 flex justify-center items-center space-x-2 md:space-x-4">
        <Button variant="outline" size="icon" onClick={toggleMute} aria-label={isMicMuted ? "Unmute Microphone" : "Mute Microphone"} disabled={!room || hasCameraPermission === false}>
          {isMicMuted ? <MicOff /> : <Mic />}
        </Button>
        <Button variant="outline" size="icon" onClick={toggleVideo} aria-label={isVidOff ? "Start Video" : "Stop Video"} disabled={!room || hasCameraPermission === false}>
          {isVidOff ? <VideoOff /> : <Video />}
        </Button>
        {/* Placeholder buttons - implement functionality as needed */}
        <Button variant="outline" size="icon" aria-label="Show Participants" disabled={!room}>
          <Users />
        </Button>
        <Button variant="outline" size="icon" aria-label="Open Chat (Optional)" disabled={!room}>
          <MessageSquare />
        </Button>
        <Button variant="destructive" size="icon" onClick={handleLeaveRoom} aria-label="Leave Call" disabled={!room}>
          <PhoneOff />
        </Button>
      </div>
    </Card>
  );
}
