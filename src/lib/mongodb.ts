
import { MongoClient, ServerApiVersion, type Db, type Collection } from 'mongodb';
import type { Consultation } from '@/types';

const uri = process.env.MONGO_URI;

if (!uri) {
  throw new Error('Please define the MONGO_URI environment variable inside .env.local');
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

interface ConnectType {
  db: Db;
  ConsultationsCollection: Collection<Consultation>;
}


// In development mode, use a global variable so that the value
// is preserved across module reloads caused by HMR (Hot Module Replacement).
// In production mode, it's best to not use a global variable.
if (process.env.NODE_ENV === 'development') {
  // Check if a global variable for the MongoDB client already exists
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, always create a new client
  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });
  clientPromise = client.connect();
}

export async function connectToDatabase(): Promise<ConnectType> {
  const client = await clientPromise;
  const db = client.db(); // Database name will be taken from the connection string
  const ConsultationsCollection = db.collection<Consultation>('consultations');
  return { db, ConsultationsCollection };
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module,the client can be shared across functions.
export default clientPromise;
