"use server";

import type { ScheduleConsultationFormData } from '@/lib/schemas';
import type { Consultation, MockConsultation } from '@/types';
import { format } from 'date-fns';

// In-memory store for mock data for demonstration
let mockConsultations: MockConsultation[] = [
  {
    id: '1',
    hostName: 'Dr. Smith',
    roomName: 'general-checkup-123',
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

export async function scheduleConsultation(data: ScheduleConsultationFormData) {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay

  // Simulate unique room name check (basic)
  if (mockConsultations.find(c => c.roomName === data.roomName)) {
    return { success: false, error: "Room name already exists. Please choose a unique name." };
  }

  const newConsultation: MockConsultation = {
    id: String(mockConsultations.length + 1),
    hostName: data.hostName,
    roomName: data.roomName,
    date: format(data.date, 'yyyy-MM-dd'),
    startTime: data.startTime,
    endTime: data.endTime,
    clients: data.clientEmails.split(',').map(email => ({ email: email.trim() })),
    createdAt: new Date(),
  };

  mockConsultations.push(newConsultation);
  
  const joinLink = `/consult/${newConsultation.roomName}`; // Assuming domain is known or relative path
  return { success: true, consultation: newConsultation, joinLink };
}

export async function getConsultationDetails(roomName: string): Promise<Consultation | null> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const consultation = mockConsultations.find(c => c.roomName === roomName);
  return consultation || null;
}

export async function verifyClientEmail(roomName: string, email: string): Promise<{ success: boolean; error?: string; clientName?: string }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const consultation = mockConsultations.find(c => c.roomName === roomName);
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
  const consultationIndex = mockConsultations.findIndex(c => c.roomName === roomName);
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
  const consultation = mockConsultations.find(c => c.roomName === roomName);
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

export async function generateTwilioToken(identity: string, roomName: string): Promise<{ success: boolean; token?: string; error?: string }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  // In a real app, this would call the Twilio API
  // For now, return a mock token
  if (identity && roomName) {
    return { success: true, token: `mock-twilio-token-for-${identity}-in-${roomName}` };
  }
  return { success: false, error: "Identity and room name are required." };
}

// Placeholder for completing a Twilio room
export async function completeTwilioRoom(roomName: string): Promise<{ success: boolean; error?: string }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log(`Simulating completion of Twilio room: ${roomName}`);
  // In a real app, this would call Twilio's REST API: client.video.rooms(roomName).update({ status: 'completed' })
  return { success: true };
}
