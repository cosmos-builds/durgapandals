import mongoose from "mongoose";

let connectionPromise: Promise<typeof mongoose> | null = null;

export interface ConnectOptions {
  uri: string;
}

// Reused across serverless invocations / hot reloads to avoid exhausting
// Atlas connection limits on the free tier.
export function connectDatabase({ uri }: ConnectOptions): Promise<typeof mongoose> {
  if (!connectionPromise) {
    mongoose.set("strictQuery", true);
    connectionPromise = mongoose.connect(uri);
  }
  return connectionPromise;
}

export async function disconnectDatabase(): Promise<void> {
  if (connectionPromise) {
    await mongoose.disconnect();
    connectionPromise = null;
  }
}
