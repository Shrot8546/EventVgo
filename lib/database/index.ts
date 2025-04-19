import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

let cached = (global as any).mongoose || { conn: null, promise: null };

export const connectToDatabase = async () => {
  if (cached.conn) return cached.conn;

  if(!MONGODB_URI) throw new Error('MONGODB_URI is missing');

  try {
    cached.promise = cached.promise || mongoose.connect(MONGODB_URI, {
      dbName: 'evently',
      bufferCommands: false,
    });

    cached.conn = await cached.promise;
    
    // Verify connection is established
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB connection not established');
    }
    
    console.log('MongoDB connection established successfully');
    return cached.conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    cached.promise = null; // Reset promise on error
    throw error;
  }
}