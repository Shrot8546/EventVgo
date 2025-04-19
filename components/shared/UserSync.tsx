"use client"

import { useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { createUser } from "@/lib/actions/user.actions"

const UserSync = () => {
  const { user, isLoaded } = useUser()
  
  useEffect(() => {
    if (isLoaded && user) {
      // Create or update user in MongoDB when component mounts
      const syncUser = async () => {
        try {
          console.log("Syncing user with MongoDB:", user.id)
          
          await createUser({
            clerkId: user.id,
            email: user.emailAddresses[0].emailAddress,
            username: user.username || user.firstName || "user",
            firstName: user.firstName || "User",
            lastName: user.lastName || "User",
            photo: user.imageUrl,
          })
          
          console.log("User synced successfully with MongoDB")
        } catch (error) {
          console.error("Error syncing user:", error)
        }
      }
      
      syncUser()
    }
  }, [isLoaded, user])
  
  // This component doesn't render anything
  return null
}

export default UserSync 