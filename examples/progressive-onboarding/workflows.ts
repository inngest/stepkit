import { z } from "zod";

import { client } from "./client";
import { emailTemplates, sendEmail } from "./email-service";
import {
  checkAccountSetup,
  checkUserActive,
  getUserActivity,
  initUserActivity,
  logActivity,
} from "./user-activity-tracker";

/**
 * Progressive Onboarding Drip Campaign Workflow
 *
 * This workflow demonstrates a multi-day onboarding sequence that:
 * 1. Sends welcome email immediately
 * 2. Checks account setup after 24 hours
 * 3. Sends feature introduction on day 3 (conditional on activity)
 * 4. Requests feedback on day 7 (skips if user is inactive)
 *
 * Key StepKit features demonstrated:
 * - Multi-day scheduling with step.sleepUntil()
 * - Conditional workflow logic
 * - External integrations (email, activity tracking)
 * - Real-world onboarding pattern
 */
export const progressiveOnboardingWorkflow = client.workflow(
  {
    id: "progressive-onboarding",
    inputSchema: z.object({
      userId: z.string(),
      email: z.email(),
      userName: z.string(),
    }),
  },
  async ({ input }, step) => {
    const { userId, email, userName } = input.data;

    console.log(
      `\n🚀 Starting progressive onboarding for ${userName} (${userId})\n`
    );

    // Initialize user activity tracking
    await step.run("initialize-user-activity", async () => {
      initUserActivity(userId);
      // logActivity(userId, "User activity tracker initialized");
      return { initialized: true };
    });

    // ═══════════════════════════════════════════════════════════
    // DAY 1: Welcome Email
    // ═══════════════════════════════════════════════════════════
    await step.run("send-welcome-email", async () => {
      console.log("📅 Day 1: Sending welcome email...");
      const template = emailTemplates.welcome(userName);
      await sendEmail(email, template);
      logActivity(userId, "Welcome email sent");
      return { sent: true, timestamp: new Date() };
    });

    // Wait 24 hours before checking account setup
    await step.run("wait-for-day-1-check", async () => {
      // Note: For demo purposes, we're using seconds instead of 24 hours
      // In production, this would be: new Date(Date.now() + 24 * 60 * 60 * 1000)
      const checkTime = new Date(Date.now() + 3000); // 3 seconds
      console.log(
        `⏰ Scheduling account setup check for: ${checkTime.toISOString()}`
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return { checkTime };
    });

    // ═══════════════════════════════════════════════════════════
    // DAY 1 (24h later): Check Account Setup
    // ═══════════════════════════════════════════════════════════
    const setupStatus = await step.run("check-account-setup", async () => {
      console.log("\n📅 Day 1 (24h later): Checking account setup...");
      const isComplete = await checkAccountSetup(userId);
      logActivity(
        userId,
        `Account setup ${isComplete ? "completed ✓" : "incomplete ✗"}`
      );
      return { complete: isComplete };
    });

    // Send reminder if setup not complete
    if (!setupStatus.complete) {
      await step.run("send-setup-reminder", async () => {
        console.log("📧 Sending account setup reminder...");
        const template = emailTemplates.accountSetup(userName);
        await sendEmail(email, template);
        logActivity(userId, "Account setup reminder sent");
        return { sent: true };
      });
    }

    // Wait until day 3
    await step.run("wait-for-day-3", async () => {
      // Note: For demo purposes, we're using seconds instead of 3 days
      // In production, this would be: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      const day3Time = new Date(Date.now() + 3000); // 3 seconds
      console.log(`\n⏰ Scheduling day 3 check for: ${day3Time.toISOString()}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return { scheduledFor: day3Time };
    });

    // ═══════════════════════════════════════════════════════════
    // DAY 3: Feature Introduction (Conditional)
    // ═══════════════════════════════════════════════════════════
    const userActivity = await step.run("get-user-activity", async () => {
      console.log("\n📅 Day 3: Checking user activity...");
      const activity = await getUserActivity(userId);
      logActivity(
        userId,
        `Activity check - Features used: ${activity.featuresUsed}, Active: ${activity.isActive}`
      );
      return activity;
    });

    // Only send feature introduction if user has some activity
    if (userActivity.featuresUsed > 0 && userActivity.featuresUsed < 5) {
      await step.run("send-feature-introduction", async () => {
        console.log(
          "📧 Sending feature introduction (user is engaging but not fully explored)..."
        );
        const template = emailTemplates.featureIntroduction(
          userName,
          userActivity.featuresUsed
        );
        await sendEmail(email, template);
        logActivity(userId, "Feature introduction email sent");
        return { sent: true };
      });
    } else if (userActivity.featuresUsed === 0) {
      await step.run("send-inactive-nudge", async () => {
        console.log("📧 Sending inactive user nudge...");
        const template = emailTemplates.inactiveUserNudge(userName);
        await sendEmail(email, template);
        logActivity(userId, "Inactive user nudge sent");
        return { sent: true };
      });
    } else {
      await step.run("skip-feature-intro", async () => {
        console.log(
          "⏭️  Skipping feature introduction (user already active power user)"
        );
        logActivity(userId, "Feature intro skipped - power user");
        return { skipped: true, reason: "power-user" };
      });
    }

    // Wait until day 7
    await step.run("wait-for-day-7", async () => {
      // Note: For demo purposes, we're using seconds instead of 7 days
      // In production, this would be: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const day7Time = new Date(Date.now() + 3000); // 3 seconds
      console.log(`\n⏰ Scheduling day 7 check for: ${day7Time.toISOString()}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return { scheduledFor: day7Time };
    });

    // ═══════════════════════════════════════════════════════════
    // DAY 7: Feedback Request (Skip if Inactive)
    // ═══════════════════════════════════════════════════════════
    const isActive = await step.run("check-if-still-active", async () => {
      console.log("\n📅 Day 7: Checking if user is still active...");
      const active = await checkUserActive(userId);
      logActivity(
        userId,
        `Day 7 activity check: ${active ? "active ✓" : "inactive ✗"}`
      );
      return { active };
    });

    if (isActive.active) {
      await step.run("send-feedback-request", async () => {
        console.log("📧 Sending feedback request (user is active)...");
        const template = emailTemplates.feedbackRequest(userName, 7);
        await sendEmail(email, template);
        logActivity(userId, "Feedback request sent");
        return { sent: true };
      });
    } else {
      await step.run("skip-feedback-request", async () => {
        console.log("⏭️  Skipping feedback request (user is inactive)");
        logActivity(userId, "Feedback request skipped - inactive user");
        return { skipped: true, reason: "inactive" };
      });
    }

    // ═══════════════════════════════════════════════════════════
    // Workflow Complete
    // ═══════════════════════════════════════════════════════════
    const summary = await step.run("generate-summary", async () => {
      console.log("\n✅ Progressive onboarding workflow completed!");
      const finalActivity = await getUserActivity(userId);

      const summary = {
        userId,
        userName,
        email,
        completedAt: new Date(),
        finalActivity: {
          accountSetupCompleted: setupStatus.complete,
          featuresUsed: finalActivity.featuresUsed,
          isActive: finalActivity.isActive,
        },
        emailsSent: {
          welcome: true,
          setupReminder: !setupStatus.complete,
          featureIntro:
            userActivity.featuresUsed > 0 && userActivity.featuresUsed < 5,
          feedback: isActive.active,
        },
      };

      console.log("\n📊 Onboarding Summary:");
      console.log("─────────────────────────────────────");
      console.log(JSON.stringify(summary, null, 2));
      console.log("─────────────────────────────────────\n");

      return summary;
    });

    return summary;
  }
);
