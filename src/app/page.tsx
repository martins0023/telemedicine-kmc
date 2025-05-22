"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Stethoscope, Video } from 'lucide-react';

export default function HomePage() {
  const [roomName, setRoomName] = useState('');
  const router = useRouter();

  const handleJoinConsultation = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomName.trim()) {
      router.push(`/consult/${roomName.trim()}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md">
      <Card className="w-full shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <Stethoscope size={32} />
          </div>
          <CardTitle className="text-3xl font-bold">KMC Telehealth with Doctor kays | Health without boarder</CardTitle>
          <CardDescription>Doctor kays | Experience reliable and efficient healthcare services with Doctor Kays. Book appointments, consult specialists, and explore personalized solutions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Link href="/schedule" legacyBehavior>
              <Button className="w-full" size="lg">
                <Video className="mr-2 h-5 w-5" /> Schedule New Consultation
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground mt-2 text-center">For healthcare providers to set up sessions.</p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>
          
          <form onSubmit={handleJoinConsultation} className="space-y-4">
            <div>
              <Label htmlFor="roomName" className="sr-only">Room Name</Label>
              <Input
                id="roomName"
                type="text"
                placeholder="Enter Consultation Room Name"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                required
                className="text-center"
              />
            </div>
            <Button type="submit" className="w-full" variant="outline" size="lg">
              Join Existing Consultation
            </Button>
            <p className="text-sm text-muted-foreground mt-2 text-center">For clients with a room name.</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
