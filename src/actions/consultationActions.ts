
"use server";

import type { ScheduleConsultationFormData } from '@/lib/schemas';
import type { Consultation } from '@/types';
import { format, parseISO } from 'date-fns';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper to normalize room names to lowercase for consistent storage and querying
const normalizeRoomName = (name: string): string => {
  return name.toLowerCase().trim();
};

export async function scheduleConsultation(data: ScheduleConsultationFormData) {
  try {
    const { ConsultationsCollection } = await connectToDatabase();
    const normalizedRoomName = normalizeRoomName(data.roomName);

    const existingConsultation = await ConsultationsCollection.findOne({ normalizedRoomName });
    if (existingConsultation) {
      return { success: false, error: "Room name already exists. Please choose a unique name." };
    }

    const newConsultationDocument: Omit<Consultation, '_id' | 'id'> = {
      hostName: data.hostName,
      roomName: data.roomName, // Store original casing for display if needed, but query by normalized
      normalizedRoomName: normalizedRoomName,
      date: format(data.date, 'yyyy-MM-dd'),
      startTime: data.startTime,
      endTime: data.endTime,
      clients: data.clientEmails.split(',').map(email => ({ email: email.trim().toLowerCase() })), // Store client emails in lowercase
      createdAt: new Date(),
    };

    const result = await ConsultationsCollection.insertOne(newConsultationDocument);
    
    if (!result.insertedId) {
        return { success: false, error: "Failed to schedule consultation in database." };
    }

    const createdConsultation: Consultation = {
        ...newConsultationDocument,
        _id: result.insertedId,
        id: result.insertedId.toHexString(),
    };

    const joinLink = `/consult/${normalizedRoomName}`;
    return { success: true, consultation: createdConsultation, joinLink };

  } catch (error) {
    console.error("Error in scheduleConsultation:", error);
    return { success: false, error: "An internal server error occurred while scheduling." };
  }
}

export async function getConsultationDetails(roomName: string): Promise<Consultation | null> {
  try {
    const { ConsultationsCollection } = await connectToDatabase();
    const normalizedSearchRoomName = normalizeRoomName(roomName);
    
    const consultationDoc = await ConsultationsCollection.findOne({ normalizedRoomName: normalizedSearchRoomName });
    if (!consultationDoc) {
      return null;
    }
    // Convert _id to string id
    const consultation: Consultation = {
        ...consultationDoc,
        id: consultationDoc._id?.toHexString(),
        // Ensure date is string formatted if it's a Date object from DB
        date: typeof consultationDoc.date === 'string' ? consultationDoc.date : format(consultationDoc.date as Date, 'yyyy-MM-dd'),
    };
    return consultation;
  } catch (error) {
    console.error("Error in getConsultationDetails:", error);
    return null;
  }
}

export async function verifyClientEmail(roomName: string, email: string): Promise<{ success: boolean; error?: string; clientName?: string }> {
  try {
    const { ConsultationsCollection } = await connectToDatabase();
    const normalizedSearchRoomName = normalizeRoomName(roomName);
    const normalizedEmail = email.toLowerCase().trim();

    const consultation = await ConsultationsCollection.findOne({ normalizedRoomName: normalizedSearchRoomName });
    if (!consultation) {
      return { success: false, error: "Consultation not found." };
    }
    const client = consultation.clients.find(c => c.email.toLowerCase() === normalizedEmail);
    if (!client) {
      return { success: false, error: "No consultation scheduled for this email." };
    }
    return { success: true, clientName: client.name };
  } catch (error) {
    console.error("Error in verifyClientEmail:", error);
    return { success: false, error: "An internal server error occurred." };
  }
}

export async function updateClientName(roomName: string, email: string, name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { ConsultationsCollection } = await connectToDatabase();
    const normalizedSearchRoomName = normalizeRoomName(roomName);
    const normalizedEmail = email.toLowerCase().trim();

    const result = await ConsultationsCollection.updateOne(
      { 
        normalizedRoomName: normalizedSearchRoomName,
        "clients.email": normalizedEmail 
      },
      { $set: { "clients.$.name": name } }
    );

    if (result.matchedCount === 0) {
      return { success: false, error: "Consultation or client not found." };
    }
    if (result.modifiedCount === 0) {
      // This could mean the name was already set to the same value
      return { success: true }; // Or a specific message if preferred
    }
    return { success: true };
  } catch (error) {
    console.error("Error in updateClientName:", error);
    return { success: false, error: "An internal server error occurred." };
  }
}

export async function extendConsultationTime(roomName: string, minutes: number): Promise<{ success: boolean; error?: string; newEndTime?: string }> {
  try {
    const { ConsultationsCollection } = await connectToDatabase();
    const normalizedSearchRoomName = normalizeRoomName(roomName);

    const consultation = await ConsultationsCollection.findOne({ normalizedRoomName: normalizedSearchRoomName });
    if (!consultation) {
      return { success: false, error: "Consultation not found." };
    }
    
    // Parse current end time. Date part is from consultation.date.
    const currentEndDateTime = parseISO(`${consultation.date}T${consultation.endTime}:00`);
    
    const newEndDateTime = new Date(currentEndDateTime.getTime() + minutes * 60000);
    const newEndTimeStr = format(newEndDateTime, 'HH:mm');

    const result = await ConsultationsCollection.updateOne(
      { _id: consultation._id },
      { $set: { endTime: newEndTimeStr } }
    );

    if (result.modifiedCount === 0) {
      return { success: false, error: "Failed to update consultation end time." };
    }
    
    return { success: true, newEndTime: newEndTimeStr };
  } catch (error) {
    console.error("Error in extendConsultationTime:", error);
    return { success: false, error: "An internal server error occurred." };
  }
}

export async function completeTwilioRoom(roomName: string): Promise<{ success: boolean; error?: string }> {
  const normalizedRoomNameToComplete = normalizeRoomName(roomName);
  try {
    // In a real scenario, you might want to mark the consultation as completed in your DB here as well.
    // For now, this function only interacts with the Twilio API endpoint.
    
    // Example: Update consultation status in MongoDB
    // const { ConsultationsCollection } = await connectToDatabase();
    // await ConsultationsCollection.updateOne(
    //   { normalizedRoomName: normalizedRoomNameToComplete },
    //   { $set: { status: "completed" } } // Assuming you add a 'status' field
    // );

    const response = await fetch(`/api/twilio/room/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roomName: normalizedRoomNameToComplete }),
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
