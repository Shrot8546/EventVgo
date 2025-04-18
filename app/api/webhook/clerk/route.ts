import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { createUser, deleteUser, updateUser } from '@/lib/actions/user.actions'
import { clerkClient } from '@clerk/nextjs'
import { NextResponse } from 'next/server'
 
export async function POST(req: Request) {
  console.log('Received webhook request from Clerk');
 
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
 
  if (!WEBHOOK_SECRET) {
    console.error('Missing WEBHOOK_SECRET');
    throw new Error('Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }
 
  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");
 
  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('Missing svix headers:', { svix_id, svix_timestamp, svix_signature });
    return new Response('Error occured -- no svix headers', {
      status: 400
    })
  }
 
  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload);
 
  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);
 
  let evt: WebhookEvent
 
  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400
    })
  }
 
  // Get the ID and type
  const { id } = evt.data;
  const eventType = evt.type;
 
  console.log('Processing webhook event:', { id, eventType });

  if(eventType === 'user.created') {
    try {
      const { id, email_addresses, image_url, first_name, last_name, username } = evt.data;
      console.log('Creating new user from webhook data:', { id, email: email_addresses[0].email_address, username, first_name, last_name });

      const user = {
        clerkId: id,
        email: email_addresses[0].email_address,
        username: username!,
        firstName: first_name,
        lastName: last_name,
        photo: image_url,
      }

      const newUser = await createUser(user);
      console.log('User created in database:', newUser?._id);

      if(newUser) {
        console.log('Updating Clerk user metadata...');
        await clerkClient.users.updateUserMetadata(id, {
          publicMetadata: {
            userId: newUser._id
          }
        })
        console.log('Clerk metadata updated successfully');
      }

      return NextResponse.json({ message: 'OK', user: newUser })
    } catch (error) {
      console.error('Error processing user.created webhook:', error);
      return new Response('Error processing user creation', { status: 500 });
    }
  }

  if (eventType === 'user.updated') {
    try {
      const {id, image_url, first_name, last_name, username } = evt.data
      console.log('Updating user:', id);

      const user = {
        firstName: first_name,
        lastName: last_name,
        username: username!,
        photo: image_url,
      }

      const updatedUser = await updateUser(id, user)
      console.log('User updated successfully:', updatedUser?._id);

      return NextResponse.json({ message: 'OK', user: updatedUser })
    } catch (error) {
      console.error('Error processing user.updated webhook:', error);
      return new Response('Error processing user update', { status: 500 });
    }
  }

  if (eventType === 'user.deleted') {
    try {
      const { id } = evt.data
      console.log('Deleting user:', id);

      const deletedUser = await deleteUser(id!)
      console.log('User deleted successfully:', deletedUser?._id);

      return NextResponse.json({ message: 'OK', user: deletedUser })
    } catch (error) {
      console.error('Error processing user.deleted webhook:', error);
      return new Response('Error processing user deletion', { status: 500 });
    }
  }
 
  console.log('Webhook processed successfully');
  return new Response('', { status: 200 })
}
 