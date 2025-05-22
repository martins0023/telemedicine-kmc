import type { ObjectId } from 'mongodb';

export interface Client {
  email: string;
  name?: string;
}

export interface Consultation {
  // _id?: ObjectId; // Removed: ObjectId is not serializable for client components
  id: string; // Use string id for client-side
  hostName: string;
  roomName: string; 
  normalizedRoomName: string; 
  date: string; 
  startTime: string; 
  endTime: string; 
  clients: Client[];
  createdAt: string; // Changed to string for serializability
}

// Mock consultation data structure is no longer primary, but kept for reference or if needed later
export interface MockConsultation extends Consultation {
  // no additional fields needed for mock currently
}
