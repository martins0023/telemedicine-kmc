export interface Client {
  email: string;
  name?: string;
}

export interface Consultation {
  id: string; // Or use MongoDB ObjectId type if interacting directly
  hostName: string;
  roomName: string;
  date: string; // Store as ISO string (YYYY-MM-DD) or Date object
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  clients: Client[];
  createdAt?: Date;
}

// Mock consultation data structure used by actions for now
export interface MockConsultation extends Consultation {
  // no additional fields needed for mock currently
}
