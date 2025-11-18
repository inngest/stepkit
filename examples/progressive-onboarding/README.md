# Progressive Onboarding Drip Campaign Example

This example demonstrates how to build a multi-day progressive onboarding workflow using StepKit In-memory driver. It showcases a realistic drip campaign that adapts based on user behavior and activity.

## Overview

The workflow implements a 7-day progressive onboarding sequence that:

1. **Day 1 (Immediate)**: Sends welcome email when user signs up
2. **Day 1 (+24h)**: Checks if account setup is complete, sends reminder if needed
3. **Day 3**: Sends feature introduction (conditional on user activity level)
4. **Day 7**: Requests feedback (skips if user is inactive)

## Workflow Architecture

```
User Signs Up
     ↓
[Send Welcome Email]
     ↓
[Wait 24 hours]
     ↓
[Check Account Setup]
     ↓
 Setup complete? ──No──→ [Send Setup Reminder]
     ↓ Yes
[Wait until Day 3]
     ↓
[Check User Activity]
     ↓
     ├─→ No activity      → [Send Inactive Nudge]
     ├─→ Some activity    → [Send Feature Intro]
     └─→ Power user       → [Skip]
     ↓
[Wait until Day 7]
     ↓
[Check if Still Active]
     ↓
 Active? ──Yes──→ [Send Feedback Request]
     ↓ No
  [Skip] → [Workflow Complete]
```


## Quick Start

### 1. Install Dependencies

From the example directory:

```bash
pnpm install
```

### 2. Run the Example

```bash
pnpm dev
```


### 3. Expected Output

You'll see output like this:

```
╔════════════════════════════════════════════════════════╗
║   Progressive Onboarding Drip Campaign Example        ║
║   Built with StepKit (In-Memory Driver)               ║
╚════════════════════════════════════════════════════════╝

🚀 Starting progressive onboarding for Alice (user_001)

📅 Day 1: Sending welcome email...

📧 ═══════════════════════════════════════
   EMAIL SENT TO: alice@example.com
   SUBJECT: Welcome to our platform! 🎉
───────────────────────────────────────
Hi Alice,

Welcome aboard! We're thrilled to have you join our platform.
...
═══════════════════════════════════════

⏰ Scheduling account setup check for: 2025-11-11T11:30:00.000Z

📅 Day 1 (24h later): Checking account setup...
...
```


## License

MIT
