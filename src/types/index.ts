import type { ObjectId } from 'mongodb';

export interface Client {
  email: string;
  name?: string;
}

export interface Consultation {
  _id?: ObjectId; // MongoDB identifier
  id?: string; // string version of _id, can be used for convenience if needed
  hostName: string;
  roomName: string; // This will be stored and queried in lowercase
  normalizedRoomName: string; // Explicitly store lowercase for querying
  date: string; // Store as ISO string (YYYY-MM-DD) or Date object for easier querying
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  clients: Client[];
  createdAt?: Date;
}

// Mock consultation data structure is no longer primary, but kept for reference or if needed later
export interface MockConsultation extends Consultation {
  // no additional fields needed for mock currently
}
