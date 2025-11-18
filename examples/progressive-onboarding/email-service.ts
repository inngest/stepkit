/**
 * Simulated email service for demonstration purposes.
 * In production, this would integrate with SendGrid, Mailgun, AWS SES, etc.
 */

export interface EmailTemplate {
  subject: string;
  body: string;
}

export const emailTemplates = {
  welcome: (userName: string): EmailTemplate => ({
    subject: "Welcome to our platform! 🎉",
    body: `
Hi ${userName},

Welcome aboard! We're thrilled to have you join our platform.

To get started:
1. Complete your profile setup
2. Explore our key features
3. Check out our getting started guide

Let us know if you need any help!

Best regards,
The Team
    `.trim(),
  }),

  accountSetup: (userName: string): EmailTemplate => ({
    subject: "Complete your account setup",
    body: `
Hi ${userName},

We noticed you haven't completed your account setup yet.

Complete these steps to unlock all features:
- Add your profile picture
- Set your preferences
- Connect your integrations

Click here to complete setup: [Setup Link]

Cheers,
The Team
    `.trim(),
  }),

  featureIntroduction: (
    userName: string,
    featuresUsed: number
  ): EmailTemplate => ({
    subject: "Discover powerful features you haven't tried yet",
    body: `
Hi ${userName},

You've been exploring the platform (${featuresUsed} features used so far) - great progress!

Here are some powerful features you might have missed:
- Advanced analytics dashboard
- Team collaboration tools
- API integrations
- Custom workflows

Ready to level up? [Explore Features]

Happy building,
The Team
    `.trim(),
  }),

  feedbackRequest: (userName: string, daysActive: number): EmailTemplate => ({
    subject: "How's your experience so far?",
    body: `
Hi ${userName},

You've been with us for ${daysActive} days now! We'd love to hear about your experience.

Your feedback helps us improve and serve you better.

Share your thoughts: [Feedback Survey]

It only takes 2 minutes and means a lot to us.

Thank you,
The Team
    `.trim(),
  }),

  inactiveUserNudge: (userName: string): EmailTemplate => ({
    subject: "We miss you! Here's what's new",
    body: `
Hi ${userName},

We noticed you haven't been active recently. We'd love to have you back!

Here's what you might have missed:
- New features released
- Community highlights
- Tips from power users

Come check it out: [Login Now]

See you soon,
The Team
    `.trim(),
  }),
};

export async function sendEmail(
  to: string,
  template: EmailTemplate
): Promise<void> {
  // Simulate email sending delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  console.log("\n📧 ═══════════════════════════════════════");
  console.log(`   EMAIL SENT TO: ${to}`);
  console.log(`   SUBJECT: ${template.subject}`);
  console.log("───────────────────────────────────────");
  console.log(template.body);
  console.log("═══════════════════════════════════════\n");
}
