
import type { ObjectId } from 'mongodb';

export interface Client {
  email: string;
  name?: string;
}

export interface Consultation {
  id: string; // Use string id for client-side
  hostName: string;
  roomName: string; 
  normalizedRoomName: string; 
  // Removed: date, startTime, endTime
  // Added: startDateTimeUTC, endDateTimeUTC
  startDateTimeUTC: string; // ISO 8601 string
  endDateTimeUTC: string;   // ISO 8601 string
  clients: Client[];
  createdAt: string; // ISO 8601 string
}
