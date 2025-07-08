
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, MessageSquare, Loader2, CameraOff, AlertTriangle } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import TwilioVideo, { connect, createLocalVideoTrack, Room, LocalTrack, LocalVideoTrack, RemoteParticipant, RemoteTrack, LocalAudioTrack } from 'twilio-video';
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
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map());
  
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVidOff, setIsVidOff] = useState(false); 
  const [isConnecting, setIsConnecting] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null); // null: checking, true: granted, false: denied

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const cleanupTracks = useCallback(() => {
    if (localVideoTrack) {
      localVideoTrack.stop();
      if (room?.localParticipant) {
        room.localParticipant.unpublishTrack(localVideoTrack);
      }
      setLocalVideoTrack(null);
    }
    if (localAudioTrack) {
      localAudioTrack.stop();
       if (room?.localParticipant) {
        room.localParticipant.unpublishTrack(localAudioTrack);
      }
      setLocalAudioTrack(null);
    }
  }, [localVideoTrack, localAudioTrack, room]);


  // Request media permissions first
  useEffect(() => {
    const getMediaPermissions = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          toast({ variant: 'destructive', title: 'Unsupported Browser', description: 'Your browser does not support camera/microphone access.' });
          setHasCameraPermission(false);
          setIsConnecting(false);
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop immediately, Twilio will manage tracks
        setHasCameraPermission(true);
        setIsVidOff(false); // Default to video on if permission granted
      } catch (error) {
        console.error('Error accessing camera/microphone:', error);
        setHasCameraPermission(false);
        setIsVidOff(true); // Keep video off if permission denied
        toast({
          variant: 'destructive',
          title: 'Media Access Denied',
          description: 'Please enable camera and microphone permissions in your browser settings.',
        });
      }
    };
    getMediaPermissions();
  }, [toast]);


  // Connect to Twilio room
  useEffect(() => {
    if (!token || !roomName || hasCameraPermission === null) {
      // Don't attempt to connect until token, roomName are available AND permission check is complete
      return;
    }

    setIsConnecting(true);

    const connectToRoom = async () => {
      try {
        const audioTrack = await TwilioVideo.createLocalAudioTrack();
        setLocalAudioTrack(audioTrack);
        
        let videoTrack: LocalVideoTrack | null = null;
        if (hasCameraPermission) {
          try {
            videoTrack = await TwilioVideo.createLocalVideoTrack({ width: 640 });
            setLocalVideoTrack(videoTrack);
             if (localVideoRef.current && videoTrack) {
              videoTrack.attach(localVideoRef.current);
            }
          } catch (videoError) {
             console.error("Failed to create local video track:", videoError);
             toast({ variant: "destructive", title: "Video Error", description: "Could not start your video. Proceeding with audio only."});
             setIsVidOff(true); // Ensure video is marked as off
          }
        } else {
            setIsVidOff(true); // Ensure video is marked as off if no permission
        }

        const tracksToPublish: LocalTrack[] = [audioTrack];
        if (videoTrack) {
          tracksToPublish.push(videoTrack);
        }

        const connectedRoom = await connect(token, {
          name: roomName,
          tracks: tracksToPublish,
          dominantSpeaker: true, 
        });

        setRoom(connectedRoom);
        setIsConnecting(false);

        // Handle existing participants
        const newRemoteParticipants = new Map(remoteParticipants);
        connectedRoom.participants.forEach(participant => {
          newRemoteParticipants.set(participant.sid, participant);
          participant.on('trackSubscribed', track => handleTrackSubscribed(track, participant));
          participant.on('trackUnsubscribed', track => handleTrackUnsubscribed(track, participant));
           participant.tracks.forEach(publication => {
            if (publication.isSubscribed && publication.track) {
              handleTrackSubscribed(publication.track, participant);
            }
          });
        });
        setRemoteParticipants(newRemoteParticipants);

        // Participant connected
        connectedRoom.on('participantConnected', (participant) => {
          console.log(`Participant connected: ${participant.identity}`);
          setRemoteParticipants(prev => new Map(prev).set(participant.sid, participant));
          participant.on('trackSubscribed', track => handleTrackSubscribed(track, participant));
          participant.on('trackUnsubscribed', track => handleTrackUnsubscribed(track, participant));
        });

        // Participant disconnected
        connectedRoom.on('participantDisconnected', (participant) => {
          console.log(`Participant disconnected: ${participant.identity}`);
          setRemoteParticipants(prev => {
            const newMap = new Map(prev);
            newMap.delete(participant.sid);
            return newMap;
          });
          // Clean up video elements for this participant
          const participantContainer = document.getElementById(`participant-${participant.sid}`);
          if (participantContainer) participantContainer.remove();
        });
        
        connectedRoom.on('disconnected', () => {
          console.log('Disconnected from room');
          cleanupTracks();
          setRoom(null);
          setRemoteParticipants(new Map());
           if (onLeaveCall) { // Ensure onLeaveCall is only called when the room is fully disconnected.
            onLeaveCall();
          }
        });


      } catch (error: any) {
        console.error('Could not connect to Twilio or create tracks:', error);
        toast({ variant: "destructive", title: "Connection Failed", description: `Could not connect to the room: ${error.message}` });
        setIsConnecting(false);
        cleanupTracks(); // Clean up any tracks that might have been created
      }
    };

    connectToRoom();

    return () => {
      if (room) {
        room.disconnect();
      }
      cleanupTracks();
      setRoom(null);
      setRemoteParticipants(new Map());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, roomName, hasCameraPermission]); // Dependencies updated

  const handleTrackSubscribed = (track: RemoteTrack, participant: RemoteParticipant) => {
    const participantContainerId = `participant-${participant.sid}`;
    let participantContainer = document.getElementById(participantContainerId);
    
    if (!participantContainer && remoteVideosRef.current) {
        participantContainer = document.createElement('div');
        participantContainer.id = participantContainerId;
        participantContainer.className = "rounded-lg bg-foreground/5 flex flex-col items-center justify-center aspect-video relative overflow-hidden p-1 shadow-md";
        
        const nameBadge = document.createElement('span');
        nameBadge.className = "absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded";
        nameBadge.innerText = participant.identity;
        participantContainer.appendChild(nameBadge);
        
        remoteVideosRef.current.appendChild(participantContainer);
    }
    
    if (participantContainer) {
      const element = track.attach();
      element.id = `${track.kind}-${participant.sid}`;
      if (track.kind === 'video') {
        element.style.width = '100%';
        element.style.height = '100%';
        element.style.objectFit = 'cover';
        // Ensure no duplicate video elements
        const existingVideo = participantContainer.querySelector('video');
        if (existingVideo) existingVideo.remove();
        participantContainer.prepend(element); // Prepend to show video first
      } else {
         // Ensure no duplicate audio elements
        const existingAudio = participantContainer.querySelector('audio');
        if (existingAudio) existingAudio.remove();
        participantContainer.appendChild(element);
      }
    }
  };

  const handleTrackUnsubscribed = (track: RemoteTrack, participant: RemoteParticipant) => {
    track.detach().forEach(element => element.remove());
    const participantContainer = document.getElementById(`participant-${participant.sid}`);
    
    // If it's a video track and there are no other video tracks for this participant, remove the container.
    // Audio tracks don't necessitate a visual container on their own.
    if (track.kind === 'video') {
        let hasOtherVideoTracks = false;
        participant.videoTracks.forEach(publication => {
            if (publication.isTrackSubscribed && publication.trackSid !== track.sid) {
                hasOtherVideoTracks = true;
            }
        });
        if (!hasOtherVideoTracks && participantContainer && !participantContainer.querySelector('video')) {
            participantContainer.remove();
        }
    }
  };

  const handleLeaveRoom = () => {
    if (room) {
      room.disconnect(); // This will trigger the 'disconnected' event which handles cleanup and onLeaveCall
    } else if (onLeaveCall) {
      // If room wasn't even connected properly, but user wants to leave this component's view
      onLeaveCall();
    }
  };

  const toggleMute = () => {
    if (!localAudioTrack) return;
    if (localAudioTrack.isEnabled) {
      localAudioTrack.disable();
      setIsMicMuted(true);
    } else {
      localAudioTrack.enable();
      setIsMicMuted(false);
    }
  };

 const toggleVideo = async () => {
    if (hasCameraPermission === false) {
         toast({ variant: "destructive", title: "Camera Disabled", description: "Camera permission is not granted."});
        return;
    }
    if (!room) return;

    if (localVideoTrack && !isVidOff) { // Video is ON, turn it OFF
      room.localParticipant.unpublishTrack(localVideoTrack);
      localVideoTrack.stop();
      setLocalVideoTrack(null);
      setIsVidOff(true);
      if (localVideoRef.current) { 
          localVideoRef.current.srcObject = null;
          const tracks = (localVideoRef.current.srcObject as MediaStream)?.getVideoTracks();
          tracks?.forEach(track => track.stop());
      }
    } else { // Video is OFF, turn it ON
      try {
        const newVideoTrack = await TwilioVideo.createLocalVideoTrack({ width: 640 });
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


  if (hasCameraPermission === null) { // Still checking permissions
    return (
      <Card className="w-full min-h-[400px] flex flex-col shadow-lg items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Requesting media permissions...</p>
      </Card>
    );
  }
  
  if (isConnecting && hasCameraPermission !== null) { // Permissions checked, now connecting
    return (
      <Card className="w-full min-h-[400px] flex flex-col shadow-lg items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Connecting to consultation...</p>
      </Card>
    );
  }


  return (
    ‎<Card className="w-full h-full flex flex-col">
‎      <CardHeader>
‎        <div>
‎          <CardTitle className="text-lg">
‎            🎥 {roomName}
‎          </CardTitle>
‎          <CardDescription className="mt-1 text-xs">
‎            You are{" "}
‎            <Badge variant={isHost ? "default" : "secondary"}>
‎              {identity}
‎            </Badge>
‎          </CardDescription>
‎        </div>
‎        <Button
‎          variant="destructive"
‎          size="icon"
‎          onClick={handleLeaveRoom}
‎          aria-label="Leave call"
‎        >
‎          <PhoneOff />
‎        </Button>
‎      </CardHeader>
‎
‎      <CardContent className="grid flex-1 grid-rows-[auto_1fr] gap-4 p-4 overflow-hidden">
‎        {/* Local preview */}
‎        <div className="relative rounded-lg overflow-hidden shadow-inner bg-foreground/10 aspect-video">
‎          <video
‎            ref={localVideoRef}
‎            autoPlay
‎            muted
‎            playsInline
‎            className="w-full h-full object-cover"
‎          />
‎          {(isVidOff || !hasCameraPermission) && (
‎            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
‎              <CameraOff size={40} className="text-white/80" />
‎              <p className="mt-2 text-white/80 text-sm">
‎                {hasCameraPermission === false
‎                  ? "Camera denied"
‎                  : "Video is off"}
‎              </p>
‎            </div>
‎          )}
‎          <Badge className="absolute top-2 left-2 text-xs bg-black/60 text-white">
‎            You
‎          </Badge>
‎        </div>
‎
‎        {/* Remote participants */}
‎        <div
‎          ref={remoteVideosRef}
‎          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto"
‎        >
‎          {room && remoteParticipants.size === 0 && (
‎            <div className="col-span-full flex flex-col items-center justify-center p-6 text-muted-foreground bg-muted/20 rounded-lg">
‎              <Users size={48} className="mb-2" />
‎              <p>Waiting for others to join…</p>
‎            </div>
‎          )}
‎          {!room && (
‎            <div className="col-span-full flex flex-col items-center justify-center p-6 text-destructive bg-destructive/10 rounded-lg">
‎              <AlertTriangle size={48} className="mb-2" />
‎              <p>Not connected to the call.</p>
‎            </div>
‎          )}
‎        </div>
‎
‎        {hasCameraPermission === false && (
‎          <Alert variant="destructive" className="mt-4">
‎            <AlertTriangle className="h-4 w-4" />
‎            <AlertTitle>Permissions Denied</AlertTitle>
‎            <AlertDescription>
‎              Enable camera/microphone in your browser and refresh.
‎            </AlertDescription>
‎          </Alert>
‎        )}
‎      </CardContent>
‎
‎      {/* Floating control bar */}
‎      <div className="flex items-center justify-center space-x-4 p-3 bg-muted/20 border-t rounded-b-2xl">
‎        <Button
‎          variant="outline"
‎          size="icon"
‎          onClick={toggleMute}
‎          aria-label={isMicMuted ? "Unmute" : "Mute"}
‎        >
‎          {isMicMuted ? <MicOff /> : <Mic />}
‎        </Button>
‎        <Button
‎          variant="outline"
‎          size="icon"
‎          onClick={toggleVideo}
‎          aria-label={isVidOff ? "Start Video" : "Stop Video"}
‎        >
‎          {isVidOff ? <VideoOff /> : <Video />}
‎        </Button>
‎        <Button
‎          variant="outline"
‎          size="icon"
‎          disabled
‎          aria-label="Participants"
‎        >
‎          <Users />
‎        </Button>
‎        <Button variant="outline" size="icon" disabled aria-label="Chat">
‎          <MessageSquare />
‎        </Button>
‎      </div>
‎    </Card> 
  );
}
