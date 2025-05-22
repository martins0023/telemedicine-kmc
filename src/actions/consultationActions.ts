
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

    // Check using the MongoDB collection type which expects _id and Date for createdAt
    const existingConsultationDoc = await ConsultationsCollection.findOne({ normalizedRoomName });
    if (existingConsultationDoc) {
      return { success: false, error: "Room name already exists. Please choose a unique name." };
    }

    // Data to be inserted into MongoDB
    const newConsultationDbData = {
      hostName: data.hostName,
      roomName: data.roomName,
      normalizedRoomName: normalizedRoomName,
      date: format(data.date, 'yyyy-MM-dd'),
      startTime: data.startTime,
      endTime: data.endTime,
      clients: data.clientEmails.split(',').map(email => ({ email: email.trim().toLowerCase() })),
      createdAt: new Date(), // Store as Date object in MongoDB
    };

    const result = await ConsultationsCollection.insertOne(newConsultationDbData);
    
    if (!result.insertedId) {
        return { success: false, error: "Failed to schedule consultation in database." };
    }

    // Data to be returned to the client (must be serializable)
    const createdConsultationForClient: Consultation = {
        hostName: newConsultationDbData.hostName,
        roomName: newConsultationDbData.roomName,
        normalizedRoomName: newConsultationDbData.normalizedRoomName,
        date: newConsultationDbData.date,
        startTime: newConsultationDbData.startTime,
        endTime: newConsultationDbData.endTime,
        clients: newConsultationDbData.clients,
        createdAt: newConsultationDbData.createdAt.toISOString(), // Convert Date to string
        id: result.insertedId.toHexString(), // Convert ObjectId to string
    };

    const joinLink = `/consult/${normalizedRoomName}`;
    return { success: true, consultation: createdConsultationForClient, joinLink };

  } catch (error) {
    console.error("Error in scheduleConsultation:", error);
    return { success: false, error: "An internal server error occurred while scheduling." };
  }
}

export async function getConsultationDetails(roomName: string): Promise<Consultation | null> {
  try {
    const { ConsultationsCollection } = await connectToDatabase();
    const normalizedSearchRoomName = normalizeRoomName(roomName);
    
    // consultationDoc is the raw document from MongoDB
    const consultationDoc = await ConsultationsCollection.findOne({ normalizedRoomName: normalizedSearchRoomName });
    if (!consultationDoc) {
      return null;
    }

    // Transform to the client-safe Consultation type
    const consultationForClient: Consultation = {
        hostName: consultationDoc.hostName,
        roomName: consultationDoc.roomName,
        normalizedRoomName: consultationDoc.normalizedRoomName,
        // Ensure date is string formatted if it's a Date object from DB (though it should be string based on insertion)
        date: typeof consultationDoc.date === 'string' ? consultationDoc.date : format(consultationDoc.date as Date, 'yyyy-MM-dd'),
        startTime: consultationDoc.startTime,
        endTime: consultationDoc.endTime,
        clients: consultationDoc.clients.map(c => ({ email: c.email, name: c.name })), 
        id: consultationDoc._id.toHexString(), // Convert ObjectId to string id
        createdAt: consultationDoc.createdAt.toISOString(), // Convert Date to ISO string
    };
    return consultationForClient;
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
    // No need to check modifiedCount specifically, if matched and no error, it's okay.
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
    
    // consultation.date is already a string 'yyyy-MM-dd'
    // consultation.endTime is 'HH:mm'
    const currentEndDateTime = parseISO(`${consultation.date}T${consultation.endTime}:00`);
    
    const newEndDateTime = new Date(currentEndDateTime.getTime() + minutes * 60000);
    const newEndTimeStr = format(newEndDateTime, 'HH:mm');

    const result = await ConsultationsCollection.updateOne(
      { _id: consultation._id }, // Use _id for update operations
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
    // Potentially update consultation status in MongoDB here
    // const { ConsultationsCollection } = await connectToDatabase();
    // await ConsultationsCollection.updateOne(
    //   { normalizedRoomName: normalizedRoomNameToComplete },
    //   { $set: { status: "completed" } } 
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
