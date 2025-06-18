
"use server";

import type { ScheduleConsultationFormData } from '@/lib/schemas';
import type { Consultation } from '@/types';
// import { format, parseISO } from 'date-fns'; // format not used directly here anymore, parseISO not needed server-side for this action
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const normalizeRoomName = (name: string): string => {
  return name.toLowerCase().trim();
};

export async function scheduleConsultation(data: ScheduleConsultationFormData) {
  try {
    const { ConsultationsCollection } = await connectToDatabase();
    const normalizedRoomName = normalizeRoomName(data.roomName);

    const existingConsultationDoc = await ConsultationsCollection.findOne({ normalizedRoomName });
    if (existingConsultationDoc) {
      return { success: false, error: "Room name already exists. Please choose a unique name." };
    }

    const [startHour, startMinute] = data.startTime.split(':').map(Number);
    const [endHour, endMinute] = data.endTime.split(':').map(Number);

    // Create a new Date object from data.date (which is host's local midnight for the selected day)
    // Then set the time components also in the host's local timezone.
    const localStartDate = new Date(data.date);
    localStartDate.setHours(startHour, startMinute, 0, 0);

    const localEndDate = new Date(data.date); // Use the same date part from data.date
    localEndDate.setHours(endHour, endMinute, 0, 0);

    // Validate that end time is after start time based on these local Date objects
    if (localEndDate.getTime() <= localStartDate.getTime()) {
        return { success: false, error: "End time must be after start time." };
    }

    const newConsultationDbData = {
      hostName: data.hostName,
      roomName: data.roomName,
      normalizedRoomName: normalizedRoomName,
      // These localStartDate/EndDate are JS Date objects representing the host's local time.
      // MongoDB will store them as BSON Dates (UTC timestamps).
      startDateTimeUTC: localStartDate,
      endDateTimeUTC: localEndDate,
      clients: data.clientEmails.split(',').map(email => ({ email: email.trim().toLowerCase() })),
      createdAt: new Date(), // Current time, stored as BSON Date (UTC)
    };

    const result = await ConsultationsCollection.insertOne(newConsultationDbData);
    
    if (!result.insertedId) {
        return { success: false, error: "Failed to schedule consultation in database." };
    }

    // For the client, convert the BSON Dates (which become JS Dates when retrieved) to ISO strings.
    // The JS Dates from newConsultationDbData.startDateTimeUTC/endDateTimeUTC are already correct instants.
    const createdConsultationForClient: Consultation = {
        hostName: newConsultationDbData.hostName,
        roomName: newConsultationDbData.roomName,
        normalizedRoomName: newConsultationDbData.normalizedRoomName,
        startDateTimeUTC: newConsultationDbData.startDateTimeUTC.toISOString(),
        endDateTimeUTC: newConsultationDbData.endDateTimeUTC.toISOString(),
        clients: newConsultationDbData.clients,
        createdAt: newConsultationDbData.createdAt.toISOString(), 
        id: result.insertedId.toHexString(), 
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
    
    const consultationDoc = await ConsultationsCollection.findOne({ normalizedRoomName: normalizedSearchRoomName });
    if (!consultationDoc) {
      return null;
    }

    // consultationDoc contains BSON Dates which are automatically converted to JS Date objects
    // These JS Date objects correctly represent the UTC instant.
    const consultationForClient: Consultation = {
        hostName: consultationDoc.hostName,
        roomName: consultationDoc.roomName,
        normalizedRoomName: consultationDoc.normalizedRoomName,
        startDateTimeUTC: (consultationDoc.startDateTimeUTC as Date).toISOString(),
        endDateTimeUTC: (consultationDoc.endDateTimeUTC as Date).toISOString(),
        clients: consultationDoc.clients.map(c => ({ email: c.email.toLowerCase(), name: c.name })), 
        id: (consultationDoc._id as ObjectId).toHexString(), 
        createdAt: (consultationDoc.createdAt as Date).toISOString(), 
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
    
    // consultation.endDateTimeUTC is retrieved as a JS Date object (UTC) from MongoDB
    const currentEndDateTimeUTC = consultation.endDateTimeUTC as Date;
    
    const newEndDateTimeUTC = new Date(currentEndDateTimeUTC.getTime() + minutes * 60000);

    const result = await ConsultationsCollection.updateOne(
      { _id: consultation._id as ObjectId }, 
      { $set: { endDateTimeUTC: newEndDateTimeUTC } } // Store as BSON Date (UTC)
    );

    if (result.modifiedCount === 0) {
      return { success: false, error: "Failed to update consultation end time." };
    }
    
    return { success: true, newEndTime: newEndDateTimeUTC.toISOString() }; // Return ISO string
  } catch (error) {
    console.error("Error in extendConsultationTime:", error);
    return { success: false, error: "An internal server error occurred." };
  }
}

export async function completeTwilioRoom(roomName: string): Promise<{ success: boolean; error?: string }> {
  const normalizedRoomNameToComplete = normalizeRoomName(roomName);
  try {
    // Ensure fetch is using an absolute URL if this runs server-side and calls itself,
    // or better, call the Twilio SDK directly if applicable.
    // For now, assuming this API is called from client or a well-defined server context.
    const domain = process.env.NEXT_PUBLIC_DOMAIN_URL || ''; // Set this in .env if needed
    const response = await fetch(`${domain}/api/twilio/room/complete`, {
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
