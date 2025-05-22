import { ScheduleForm } from "@/components/consultation/ScheduleForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stethoscope } from "lucide-react";

export default function SchedulePage() {
  return (
    <div className="w-full max-w-2xl">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <Stethoscope size={32} />
          </div>
          <CardTitle className="text-2xl font-semibold">Schedule New Consultation</CardTitle>
          <CardDescription>Fill in the details to create a new video consultation session.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduleForm />
        </CardContent>
      </Card>
    </div>
  );
}
