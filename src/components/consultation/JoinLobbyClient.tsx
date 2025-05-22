
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { VerifyEmailSchema, type VerifyEmailFormData, EnterNameSchema, type EnterNameFormData } from "@/lib/schemas";
import { verifyClientEmail, updateClientName, completeTwilioRoom, getConsultationDetails } from "@/actions/consultationActions";
import type { Consultation } from "@/types";
import { AlertCircle, CheckCircle, Clock, Loader2, LogIn, UserPlus, Video as VideoIcon, AlertTriangle, BadgePercent, UserCircle2 } from "lucide-react";
import { ExtensionModal } from "./ExtensionModal";
import { VideoComponentPlaceholder } from "./VideoComponentPlaceholder"; 
import { differenceInSeconds, formatDistanceToNowStrict, parse } from "date-fns";

type JoinLobbyClientProps = {
  roomName: string;
  initialConsultationDetails: Consultation;
};

type JoinStage = "EMAIL_PROMPT" | "NAME_PROMPT" | "LOBBY" | "IN_CALL" | "ENDED";

export function JoinLobbyClient({ roomName, initialConsultationDetails }: JoinLobbyClientProps) {
  const [stage, setStage] = useState<JoinStage>("EMAIL_PROMPT");
  const [isLoading, setIsLoading] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [consultationDetails, setConsultationDetails] = useState<Consultation>(initialConsultationDetails);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [twilioToken, setTwilioToken] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [canJoin, setCanJoin] = useState(false);
  const [sessionStatusMessage, setSessionStatusMessage] = useState("");

  const { toast } = useToast();

  const emailForm = useForm<VerifyEmailFormData>({
    resolver: zodResolver(VerifyEmailSchema),
    defaultValues: { email: "" },
  });

  const nameForm = useForm<EnterNameFormData>({
    resolver: zodResolver(EnterNameSchema),
    defaultValues: { name: "" },
  });

  const { hostName, date, startTime, endTime } = consultationDetails;

  const startDateTime = useMemo(() => parse(`${date} ${startTime}`, 'yyyy-MM-dd HH:mm', new Date()), [date, startTime]);
  const endDateTime = useMemo(() => parse(`${date} ${endTime}`, 'yyyy-MM-dd HH:mm', new Date()), [date, endTime]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (stage === "ENDED") {
        clearInterval(interval);
        return;
      }

      if (now > endDateTime) {
        setSessionStatusMessage("This consultation has ended.");
        setCanJoin(false);
        if (stage === "IN_CALL") {
           completeTwilioRoom(roomName).then(() => {
             toast({ title: "Session Ended", description: "The consultation time is over." });
           });
        }
        setStage("ENDED"); 
        setTimeLeft("");
      } else if (now < startDateTime) {
        setSessionStatusMessage(`Consultation starts in ${formatDistanceToNowStrict(startDateTime)}.`);
        setTimeLeft(formatDistanceToNowStrict(startDateTime, { unit: 'second' }));
        setCanJoin(false);
      } else { 
        setSessionStatusMessage(`Consultation ends in ${formatDistanceToNowStrict(endDateTime)}.`);
        setTimeLeft(formatDistanceToNowStrict(endDateTime, { unit: 'second' }));
        setCanJoin(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startDateTime, endDateTime, stage, roomName, toast]);


  async function handleEmailSubmit(data: VerifyEmailFormData) {
    setIsLoading(true);
    const result = await verifyClientEmail(roomName, data.email);
    if (result.success) {
      setVerifiedEmail(data.email);
      if (result.clientName) {
        setClientName(result.clientName);
        setStage("LOBBY");
        toast({ title: "Email Verified", description: `Welcome back, ${result.clientName}!`, icon: <CheckCircle className="h-5 w-5 text-green-500" /> });
      } else {
        setStage("NAME_PROMPT");
        toast({ title: "Email Verified", description: "Please enter your name to proceed.", icon: <CheckCircle className="h-5 w-5 text-green-500" /> });
      }
    } else {
      toast({ title: "❌ Verification Failed", description: result.error, variant: "destructive" });
    }
    setIsLoading(false);
  }

  async function handleNameSubmit(data: EnterNameFormData) {
    if (!verifiedEmail) return;
    setIsLoading(true);
    const result = await updateClientName(roomName, verifiedEmail, data.name);
    if (result.success) {
      setClientName(data.name);
      setStage("LOBBY");
      toast({ title: "Name Set", description: `Welcome, ${data.name}!`, icon: <UserPlus className="h-5 w-5 text-primary" /> });
    } else {
      toast({ title: "❌ Update Failed", description: result.error, variant: "destructive" });
    }
    setIsLoading(false);
  }

  async function handleJoinCall() {
    if (!verifiedEmail || !clientName) {
      toast({ title: "Error", description: "User details missing.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identity: clientName, roomName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch token: ${response.statusText}`);
      }

      const tokenResult = await response.json();

      if (tokenResult.token) {
        setTwilioToken(tokenResult.token);
        setStage("IN_CALL");
        toast({ title: "Joining Call...", icon: <VideoIcon className="h-5 w-5 text-primary" /> });
      } else {
        toast({ title: "❌ Failed to Join", description: "Could not get access token from server.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error fetching Twilio token:", error);
      toast({ title: "❌ Failed to Join", description: error.message || "An error occurred while trying to join the call.", variant: "destructive" });
    }
    setIsLoading(false);
  }

  const handleLeaveCallFromVideoComponent = useCallback(() => {
    setStage("LOBBY"); 
    setTwilioToken(null); 
    toast({title: "Call Ended", description: "You have left the consultation."});
  }, [toast]);

  const handleExtendSuccess = async (newEndTime: string) => {
    toast({
      title: "✅ Consultation Extended!",
      description: `New end time: ${newEndTime}.`,
    });
    const updatedDetails = await getConsultationDetails(roomName);
    if (updatedDetails) {
      setConsultationDetails(updatedDetails);
    }
    setShowExtensionModal(false);
  };

  const cardIcon = useMemo(() => {
    switch (stage) {
      case "EMAIL_PROMPT": return <LogIn className="h-8 w-8 text-primary" />;
      case "NAME_PROMPT": return <UserCircle2 className="h-8 w-8 text-primary" />;
      case "LOBBY": return <Clock className="h-8 w-8 text-primary" />;
      case "IN_CALL": return <VideoIcon className="h-8 w-8 text-green-500" />;
      case "ENDED": return <AlertTriangle className="h-8 w-8 text-destructive" />;
      default: return <LogIn className="h-8 w-8 text-primary" />;
    }
  }, [stage]);

  return (
    <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 text-primary rounded-full p-3 w-fit mb-4">
             {cardIcon}
          </div>
          <CardTitle>Consultation: {roomName}</CardTitle>
          <CardDescription>Hosted by: {hostName}</CardDescription>
        </CardHeader>

        <CardContent>
          {stage === "EMAIL_PROMPT" && (
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-4">
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify Email"}
                </Button>
              </form>
            </Form>
          )}

          {stage === "NAME_PROMPT" && (
            <Form {...nameForm}>
              <form onSubmit={nameForm.handleSubmit(handleNameSubmit)} className="space-y-4">
                <FormField
                  control={nameForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your display name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirm Name"}
                </Button>
              </form>
            </Form>
          )}

          {stage === "LOBBY" && (
            <div className="text-center space-y-4">
              <p className="text-lg font-semibold">Welcome, {clientName}!</p>
              <div className="p-4 border rounded-md bg-background shadow">
                <p className="text-sm text-muted-foreground">{sessionStatusMessage}</p>
                {timeLeft && !sessionStatusMessage.startsWith("Consultation ends in") && <p className="text-2xl font-bold text-primary">{timeLeft}</p>}
                 {timeLeft && sessionStatusMessage.startsWith("Consultation ends in") && <p className="text-xl font-semibold text-primary">Time remaining: {timeLeft}</p>}
              </div>
              <Button onClick={handleJoinCall} className="w-full" disabled={!canJoin || isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><VideoIcon className="mr-2 h-5 w-5" />Join Consultation</>}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setShowExtensionModal(true)} disabled={!canJoin}>
                <BadgePercent className="mr-2 h-4 w-4" /> Extend Slot / Buy More Time
              </Button>
            </div>
          )}

          {stage === "IN_CALL" && twilioToken && clientName && (
            <div>
              <VideoComponentPlaceholder 
                roomName={roomName} 
                token={twilioToken} 
                identity={clientName} 
                isHost={false} 
                onLeaveCall={handleLeaveCallFromVideoComponent}
              />
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <Button variant="outline" className="w-full sm:w-auto flex-1" onClick={() => setShowExtensionModal(true)}>
                  <BadgePercent className="mr-2 h-4 w-4" /> Buy More Minutes
                </Button>
              </div>
            </div>
          )}
          
          {stage === "ENDED" && (
             <div className="text-center space-y-4 p-4 border border-destructive bg-destructive/10 rounded-md">
              <p className="text-lg font-semibold text-destructive">{sessionStatusMessage}</p>
              <p className="text-sm text-muted-foreground">This consultation slot has concluded.</p>
            </div>
          )}

        </CardContent>
        <CardFooter className="text-xs text-muted-foreground text-center block pt-4">
          Scheduled: {new Date(date + ' ' + startTime).toLocaleString()} - {new Date(date + ' ' + endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </CardFooter>
      </Card>

      <ExtensionModal
        isOpen={showExtensionModal}
        onClose={() => setShowExtensionModal(false)}
        roomName={roomName}
        currentEndTime={consultationDetails.endTime}
        onExtensionSuccess={handleExtendSuccess}
      />
    </div>
  );
}
