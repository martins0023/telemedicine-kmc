
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { extendConsultationTime } from "@/actions/consultationActions";
import { Loader2, CreditCard } from "lucide-react";
import { parseISO } from "date-fns";

type ExtensionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  currentEndTime: string; // This is for display (local time string)
  currentEndTimeUTC: string; // This is the UTC ISO string for logic
  onExtensionSuccess: (newEndTimeISO: string) => void;
};

const extensionOptions = [
  { minutes: 15, price: 5.00, label: "15 minutes - $5.00" },
  { minutes: 30, price: 9.00, label: "30 minutes - $9.00" },
  { minutes: 60, price: 15.00, label: "60 minutes - $15.00" },
];

export function ExtensionModal({ isOpen, onClose, roomName, currentEndTime, currentEndTimeUTC, onExtensionSuccess }: ExtensionModalProps) {
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handlePayment = async () => {
    if (!selectedMinutes) {
      toast({ title: "Selection Error", description: "Please select an extension duration.", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    toast({ title: "Processing Payment...", description: "Redirecting to payment gateway (simulation)." });
    await new Promise(resolve => setTimeout(resolve, 2000)); 

    // The extendConsultationTime action now works with UTC internally
    // and expects the roomName and the number of minutes to extend.
    // It will fetch the current UTC end time from the database.
    const result = await extendConsultationTime(roomName, selectedMinutes);

    if (result.success && result.newEndTime) { // newEndTime is an ISO string
      onExtensionSuccess(result.newEndTime);
    } else {
      toast({ title: "❌ Extension Failed", description: result.error || "Could not extend time.", variant: "destructive" });
    }
    
    setIsLoading(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Extend Consultation Time</DialogTitle>
          <DialogDescription>
            Current session for <span className="font-semibold">{roomName}</span> ends at <span className="font-semibold">{currentEndTime}</span>.
            Select an option to extend your consultation.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <RadioGroup onValueChange={(value) => setSelectedMinutes(Number(value))} defaultValue={selectedMinutes?.toString()}>
            {extensionOptions.map(option => (
              <div key={option.minutes} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-accent/50 transition-colors">
                <RadioGroupItem value={String(option.minutes)} id={`ext-${option.minutes}`} />
                <Label htmlFor={`ext-${option.minutes}`} className="flex-1 cursor-pointer">{option.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button onClick={handlePayment} disabled={!selectedMinutes || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
            Proceed to Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
