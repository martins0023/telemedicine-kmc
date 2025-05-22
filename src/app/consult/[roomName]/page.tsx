import { JoinLobbyClient } from "@/components/consultation/JoinLobbyClient";
import { getConsultationDetails } from "@/actions/consultationActions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

type ConsultPageProps = {
  params: { roomName: string };
};

export default async function ConsultPage({ params }: ConsultPageProps) {
  const { roomName } = params;
  const consultationDetails = await getConsultationDetails(roomName);

  if (!consultationDetails) {
    return (
      <div className="w-full max-w-md text-center">
        <Card className="shadow-xl">
          <CardHeader>
            <div className="mx-auto bg-destructive text-destructive-foreground rounded-full p-3 w-fit mb-4">
              <AlertTriangle size={32} />
            </div>
            <CardTitle>Consultation Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              The consultation with room name "{roomName}" could not be found.
              Please check the name or contact support.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <JoinLobbyClient roomName={roomName} initialConsultationDetails={consultationDetails} />
  );
}
