/* eslint-disable */
/**
 * Simulated user activity tracker for demonstration purposes.
 * In production, this would integrate with your analytics system (Mixpanel, Segment, etc.)
 */

export interface UserActivity {
  userId: string;
  accountSetupCompleted: boolean;
  featuresUsed: number;
  lastActiveDate: Date;
  isActive: boolean; // Active in last 7 days
}

// Simulated in-memory user activity store
const userActivityStore = new Map<string, UserActivity>();

export function initUserActivity(userId: string): void {
  userActivityStore.set(userId, {
    userId,
    accountSetupCompleted: false,
    featuresUsed: 0,
    lastActiveDate: new Date(),
    isActive: true,
  });
}

export async function checkAccountSetup(userId: string): Promise<boolean> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 50));

  const activity = userActivityStore.get(userId);

  // For demo purposes, randomly determine if setup is complete
  // In production, this would check actual user data
  if (activity && !activity.accountSetupCompleted) {
    const setupComplete = Math.random() > 0.5;
    activity.accountSetupCompleted = setupComplete;
    userActivityStore.set(userId, activity);
  }

  return activity?.accountSetupCompleted ?? false;
}

export async function getUserActivity(userId: string): Promise<UserActivity> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 50));

  const activity = userActivityStore.get(userId) ?? {
    userId,
    accountSetupCompleted: false,
    featuresUsed: 0,
    lastActiveDate: new Date(),
    isActive: false,
  };

  // For demo purposes, simulate some activity growth
  if (activity.isActive) {
    activity.featuresUsed = Math.min(
      activity.featuresUsed + Math.floor(Math.random() * 3),
      10
    );
    activity.isActive = Math.random() > 0.3; // 70% chance still active
  }

  userActivityStore.set(userId, activity);
  return activity;
}

export async function checkUserActive(userId: string): Promise<boolean> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 50));

  const activity = await getUserActivity(userId);
  return activity.isActive;
}

export function logActivity(userId: string, message: string): void {
  console.log(`[Activity Tracker] ${userId}: ${message}`);
}
