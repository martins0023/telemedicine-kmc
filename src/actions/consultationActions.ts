
"use server";

import type { ScheduleConsultationFormData } from '@/lib/schemas';
import type { Consultation, MockConsultation } from '@/types';
import { format } from 'date-fns';

// In-memory store for mock data for demonstration
let mockConsultations: MockConsultation[] = [
  {
    id: '1',
    hostName: 'Dr. Smith',
    roomName: 'general-checkup-123', // Will be treated as lowercase if this initial data is used for lookups
    date: '2024-08-15', // YYYY-MM-DD
    startTime: '10:00',
    endTime: '10:30',
    clients: [
      { email: 'test@example.com', name: 'Test User' },
      { email: 'patient@example.com' },
    ],
    createdAt: new Date(),
  }
];

// Helper to normalize room names
const normalizeRoomName = (name: string): string => {
  return name.toLowerCase().trim();
};

export async function scheduleConsultation(data: ScheduleConsultationFormData) {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay

  const normalizedRoomName = normalizeRoomName(data.roomName);

  // Simulate unique room name check (case-insensitive)
  if (mockConsultations.find(c => c.roomName === normalizedRoomName)) {
    return { success: false, error: "Room name already exists. Please choose a unique name." };
  }

  const newConsultation: MockConsultation = {
    id: String(mockConsultations.length + 1),
    hostName: data.hostName,
    roomName: normalizedRoomName, // Store normalized room name
    date: format(data.date, 'yyyy-MM-dd'),
    startTime: data.startTime,
    endTime: data.endTime,
    clients: data.clientEmails.split(',').map(email => ({ email: email.trim() })),
    createdAt: new Date(),
  };

  mockConsultations.push(newConsultation);
  
  const joinLink = `/consult/${newConsultation.roomName}`; // Link will use normalized (lowercase) room name
  return { success: true, consultation: newConsultation, joinLink };
}

export async function getConsultationDetails(roomName: string): Promise<Consultation | null> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const normalizedSearchRoomName = normalizeRoomName(roomName);
  const consultation = mockConsultations.find(c => c.roomName === normalizedSearchRoomName);
  return consultation || null;
}

export async function verifyClientEmail(roomName: string, email: string): Promise<{ success: boolean; error?: string; clientName?: string }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const normalizedSearchRoomName = normalizeRoomName(roomName);
  const consultation = mockConsultations.find(c => c.roomName === normalizedSearchRoomName);
  if (!consultation) {
    return { success: false, error: "Consultation not found." };
  }
  const client = consultation.clients.find(c => c.email.toLowerCase() === email.toLowerCase());
  if (!client) {
    return { success: false, error: "No consultation scheduled for this email." };
  }
  return { success: true, clientName: client.name };
}

export async function updateClientName(roomName: string, email: string, name: string): Promise<{ success: boolean; error?: string }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const normalizedSearchRoomName = normalizeRoomName(roomName);
  const consultationIndex = mockConsultations.findIndex(c => c.roomName === normalizedSearchRoomName);
  if (consultationIndex === -1) {
    return { success: false, error: "Consultation not found." };
  }
  const clientIndex = mockConsultations[consultationIndex].clients.findIndex(c => c.email.toLowerCase() === email.toLowerCase());
  if (clientIndex === -1) {
    return { success: false, error: "Client not found for this email." };
  }
  mockConsultations[consultationIndex].clients[clientIndex].name = name;
  return { success: true };
}

export async function extendConsultationTime(roomName: string, minutes: number): Promise<{ success: boolean; error?: string; newEndTime?: string }> {
  await new Promise(resolve => setTimeout(resolve, 1000));
  const normalizedSearchRoomName = normalizeRoomName(roomName);
  const consultation = mockConsultations.find(c => c.roomName === normalizedSearchRoomName);
  if (!consultation) {
    return { success: false, error: "Consultation not found." };
  }

  // Simulate time extension
  const [hours, mins] = consultation.endTime.split(':').map(Number);
  const currentEndTime = new Date();
  currentEndTime.setHours(hours, mins, 0, 0);
  currentEndTime.setMinutes(currentEndTime.getMinutes() + minutes);
  
  const newEndTimeStr = `${String(currentEndTime.getHours()).padStart(2, '0')}:${String(currentEndTime.getMinutes()).padStart(2, '0')}`;
  consultation.endTime = newEndTimeStr;
  
  return { success: true, newEndTime: newEndTimeStr };
}

// Placeholder for completing a Twilio room
// This function now directly calls the API route for completing a Twilio room.
// The roomName passed here should be the one Twilio expects. 
// Since we are normalizing room names to lowercase for our internal DB and for join links,
// the roomName used to create/join Twilio rooms will also be lowercase.
export async function completeTwilioRoom(roomName: string): Promise<{ success: boolean; error?: string }> {
  const normalizedRoomNameToComplete = normalizeRoomName(roomName); // Ensure consistency if called externally with non-normalized name
  try {
    const response = await fetch(`/api/twilio/room/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roomName: normalizedRoomNameToComplete }), // Send normalized name
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Failed to complete Twilio room ${normalizedRoomNameToComplete}: ${response.status} - ${errorData.error || 'Unknown error'}`);
      return { success: false, error: errorData.error || `Failed to complete room: ${response.statusText}` };
    }

    const result = await response.json();
    if (result.success) {
      console.log(`Successfully completed Twilio room: ${normalizedRoomNameToComplete}`);
      return { success: true };
    } else {
      console.error(`API reported failure to complete Twilio room ${normalizedRoomNameToComplete}: ${result.message || result.error}`);
      return { success: false, error: result.message || result.error || "API call to complete room was not successful." };
    }
  } catch (error: any) {
    console.error(`Error completing Twilio room ${normalizedRoomNameToComplete} via API call:`, error);
    return { success: false, error: `Exception when trying to complete room: ${error.message}` };
  }
}
