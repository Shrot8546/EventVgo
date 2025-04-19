'use server'

import { revalidatePath } from 'next/cache'
import mongoose from 'mongoose'

import { connectToDatabase } from '@/lib/database'
import User from '@/lib/database/models/user.model'
import Order from '@/lib/database/models/order.model'
import Event from '@/lib/database/models/event.model'
import { handleError } from '@/lib/utils'

import { CreateUserParams, UpdateUserParams } from '@/types'

export async function createUser(user: CreateUserParams) {
  try {
    console.log('Connecting to database for user creation...');
    await connectToDatabase();
    console.log('Database connected successfully');

    // Validate required fields
    const requiredFields: (keyof CreateUserParams)[] = ['clerkId', 'email', 'username', 'firstName', 'lastName', 'photo'];
    for (const field of requiredFields) {
      if (!user[field]) {
        console.error(`Missing required field: ${field}`);
        throw new Error(`Missing required field: ${field}`);
      }
    }

    console.log('Creating new user with data:', { ...user, password: '[REDACTED]' });
    console.log('MongoDB connection state:', mongoose.connection.readyState);
    
    const newUser = await User.create(user);
    console.log('User created successfully:', newUser._id);
    console.log('Full user document:', JSON.stringify(newUser, null, 2));

    return JSON.parse(JSON.stringify(newUser));
  } catch (error) {
    console.error('Error in createUser:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });

    // Check for MongoDB duplicate key error
    if (error instanceof Error && 'code' in error && (error as any).code === 11000) {
      const duplicateKey = 'keyValue' in error ? Object.keys((error as any).keyValue)[0] : 'unknown';
      console.error('Duplicate key error:', duplicateKey);
      throw new Error(`Duplicate key error: ${duplicateKey} already exists.`);
    }

    handleError(error);
  }
}

export async function getUserById(userId: string) {
  try {
    await connectToDatabase()

    const user = await User.findById(userId)

    if (!user) throw new Error('User not found')
    return JSON.parse(JSON.stringify(user))
  } catch (error) {
    handleError(error)
  }
}

export async function updateUser(clerkId: string, user: UpdateUserParams) {
  try {
    await connectToDatabase()

    const updatedUser = await User.findOneAndUpdate({ clerkId }, user, { new: true })

    if (!updatedUser) throw new Error('User update failed')
    return JSON.parse(JSON.stringify(updatedUser))
  } catch (error) {
    handleError(error)
  }
}

export async function deleteUser(clerkId: string) {
  try {
    await connectToDatabase()

    // Find user to delete
    const userToDelete = await User.findOne({ clerkId })

    if (!userToDelete) {
      throw new Error('User not found')
    }

    // Unlink relationships
    await Promise.all([
      // Update the 'events' collection to remove references to the user
      Event.updateMany(
        { _id: { $in: userToDelete.events } },
        { $pull: { organizer: userToDelete._id } }
      ),

      // Update the 'orders' collection to remove references to the user
      Order.updateMany({ _id: { $in: userToDelete.orders } }, { $unset: { buyer: 1 } }),
    ])

    // Delete user
    const deletedUser = await User.findByIdAndDelete(userToDelete._id)
    revalidatePath('/')

    return deletedUser ? JSON.parse(JSON.stringify(deletedUser)) : null
  } catch (error) {
    handleError(error)
  }
}
