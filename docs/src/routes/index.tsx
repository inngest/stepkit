import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Header } from '@/components/header';
import { PlatformLanguageIcon } from '@/components/icon-platform-language';
import { RefactoringIcon } from '@/components/icon-refactoring';
import { ExtensibleIcon } from '@/components/icon-extensible';
import { SectionRule } from '@/components/section-rule';

export const Route = createFileRoute('/')({
  component: Home,
});

const workflowFeatures = [
  {
    id: '01',
    label: 'Durable steps',
    description:
    'Build workflows using simple steps, with automatic retries, state, and observability built in.',
    code: `// Payment processing survives failures
const payment = await step.run('charge-card', async () => {
  const charge = await stripe.charges.create({
    amount: 2999,
    currency: 'usd',
    customer: customerId
  });
  return charge;
});

// If workflow fails here, charge won't be retried
await step.run('update-database', async () => {
  await db.orders.create({
    userId,
    paymentId: payment.id,
    status: 'completed'
  });
});`,
  },
  {
    id: '02',
    label: 'Sleep',
    description:
    'Sleep for minutes, days, or weeks without worrying about timeouts, queueing systems, or jobs.',
    code: `// Start user's trial
await step.run('activate-trial', async () => {
  await db.users.update(userId, {
    trialStarted: new Date(),
    trialEndsAt: addDays(new Date(), 14)
  });
});

// Sleep for 10 days - no compute, no costs
await step.sleep('wait-for-trial-end', '10d');

// Send trial ending reminder
await step.run('send-trial-reminder', async () => {
  await sendEmail(userEmail, {
    subject: 'Your trial ends in 4 days',
    template: 'trial-ending'
  });
});`,
  },
  {
    id: '03',
    label: 'Retries',
    description:
    'Recover from transient errors, timeouts, and upstream issues automatically with built in retries.',
    code: `// API call with automatic exponential backoff
const user = await step.run('fetch-user-profile', async () => {
  const response = await fetch(\`\${API_URL}/users/\${userId}\`);
  if (!response.ok) {
    throw new Error('API request failed - will automatically retry');
  }
  return response.json();
});

// Sync to external system with retries
await step.run('sync-to-crm', async () => {
  await salesforce.contacts.update(user.email, {
    name: user.name,
    company: user.company
  });
});`,
  },
  {
    id: '04',
    label: 'Suspend & Resume',
    description:
    'Pause workflows to wait for webhooks, user actions, or external events, then resume exactly where they left off.',
    code: `// Create Stripe checkout session
const session = await step.run('create-checkout', async () => {
  return await stripe.checkout.sessions.create({
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'payment'
  });
});

// Suspend until webhook received
const payment = await step.waitForEvent('wait-for-payment', {
  event: 'stripe/checkout.completed',
  timeout: '1h'
});

// Continue after payment confirmed
await step.run('fulfill-order', async () => {
  await fulfillOrder(payment.orderId);
});`,
  },
  {
    id: '05',
    label: 'Parallelism',
    description:
    'Speed up workflows by running steps in parallel. Each step remains durable, retryable, and observable.',
    code: `// Fetch data from multiple sources in parallel
const [user, orders, analytics] = await Promise.all([
  step.run('fetch-user', async () => {
    return await db.users.findById(userId);
  }),
  step.run('fetch-orders', async () => {
    return await db.orders.findByUser(userId);
  }),
  step.run('fetch-analytics', async () => {
    return await analytics.getUserMetrics(userId);
  })
]);

// Generate report with all data
await step.run('generate-report', async () => {
  return generateUserReport({ user, orders, analytics });
});`,
  },
  {
    id: '06',
    label: 'AI Agents',
    description:
    'Build reliable AI agents where every action is durable. Agent loops survive failures, LLM timeouts, and rate limits automatically.',
    code: `// AI agent decides what to do next
const plan = await step.run('llm-plan', async () => {
  return await llm.chat({
    prompt: \`Research topic: \${topic}\`,
    tools: ['web_search', 'summarize', 'save']
  });
});

// Execute each action as a durable step, with full observabulity
for (const action of plan.actions) {
  await step.run(\`action-\${action.id}\`, async () => {
    if (action.tool === 'web_search') {
      return await searchWeb(action.query);
    }
    if (action.tool === 'summarize') {
      return await summarize(action.content);
    }
    if (action.tool === 'save') {
      return await saveResults(action.data);
    }
  });
}`,
  },
  /*
  {
    id: '07',
    label: 'Iteration',
    description:
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris et feugiat arcu, vitae lobortis purus.',
    code: `let iteration = 0;
await step.until('stable-result', async () => {
iteration += 1;
return runAttempt(iteration);
});`,
  },
  */
];

const howItWorksSteps = [
  {
    title: 'Choose your driver',
    description:
    "Your driver determines how to handle infrastructure and where to persist state—queues, retries, persistence. Not sure what to choose? StepKit makes it possible to switch between any supported drivers without changing workflow code.",
    icon: (
      <svg width="154" height="176" viewBox="0 0 154 176" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M76.5078 174.906L152.016 131.36V97.9004L76.5078 141.464V174.906Z" fill="#2C9B63" stroke="#1E1E1E" strokeMiterlimit="10"/>
        <path d="M76.5082 141.465L152.016 97.9009L76.5265 54.3555L1 97.9009L76.5082 141.465Z" fill="#2C9B63" stroke="#1E1E1E" strokeMiterlimit="10"/>
        <path d="M1 131.36L76.5082 174.906V141.464L1 97.9004V131.36Z" fill="#2C9B63" stroke="#1E1E1E" strokeMiterlimit="10"/>
        <path d="M76.5078 121.128L152.016 77.5646V44.123L76.5078 87.6684V121.128Z" fill="#2C9B63" stroke="#1E1E1E" strokeMiterlimit="10"/>
        <path d="M76.5082 87.6679L152.016 44.1225L76.5265 0.577148L1 44.1225L76.5082 87.6679Z" fill="#2C9B63" stroke="#1E1E1E" strokeMiterlimit="10"/>
        <path d="M1 77.5646L76.5082 121.128V87.6684L1 44.123V77.5646Z" fill="#2C9B63" stroke="#1E1E1E" strokeMiterlimit="10"/>
        <path d="M50.1641 89.2055C50.1641 91.9511 52.088 95.3008 54.4882 96.6736C56.8702 98.0464 58.8124 96.9298 58.8124 94.1842C58.8124 91.4386 56.8885 88.089 54.4882 86.7162C52.1063 85.3434 50.1641 86.4599 50.1641 89.2055Z" fill="#2C9B63" stroke="#1E1E1E" strokeMiterlimit="10"/>
        <path d="M34.4375 80.1264C34.4375 82.872 36.3614 86.2217 38.7617 87.5945C41.1436 88.9673 43.0859 87.8507 43.0859 85.1051C43.0859 82.3595 41.162 79.0099 38.7617 77.6371C36.3797 76.2643 34.4375 77.3808 34.4375 80.1264Z" fill="#2C9B63" stroke="#1E1E1E" strokeMiterlimit="10"/>
        <path d="M18.7188 71.0659C18.7188 73.8115 20.6426 77.1611 23.0429 78.5339C25.4249 79.9067 27.3671 78.7902 27.3671 76.0446C27.3671 73.299 25.4432 69.9493 23.0429 68.5765C20.661 67.2037 18.7188 68.3203 18.7188 71.0659Z" fill="#2C9B63" stroke="#1E1E1E" strokeMiterlimit="10"/>
      </svg>
    ),
  },
  {
    title: 'Write steps with IDs',
    description:
    "Every step gets an identifier that becomes your workflow's source of truth, so functions remain stable and observable as your code evolves. The driver you choose will use these IDs to track progress through sleeps, waits, and retries.",
    icon: (
      <svg width="174" height="202" viewBox="0 0 174 202" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M172.211 51.0923L162.168 59.5527V158.092L173.168 149.632L172.211 51.0923Z" fill="#2C9B63"/>
        <path d="M172.211 51.0923L162.168 59.5527V158.092L173.168 149.632L172.211 51.0923Z" stroke="#1E1E1E"/>
        <path d="M161.918 158.092L62.918 108.419V9.09229L161.918 58.7651V158.092Z" fill="#2C9B63" stroke="#242424" strokeMiterlimit="10"/>
        <path d="M73.418 0.592285L62.918 9.09229L161.918 58.5923L172.418 50.5923L73.418 0.592285Z" fill="#2C9B63" stroke="#1E1E1E"/>
        <path d="M141.211 72.0923L131.168 80.5527V179.092L142.168 170.632L141.211 72.0923Z" fill="#2C9B63" stroke="#1E1E1E"/>
        <path d="M130.918 179.092L31.918 129.419V30.0923L130.918 79.7651V179.092Z" fill="#2C9B63" stroke="#242424" strokeMiterlimit="10"/>
        <path d="M42.418 21.5923L31.918 30.0923L130.918 79.5923L141.418 71.5923L42.418 21.5923Z" fill="#2C9B63" stroke="#1E1E1E"/>
        <path d="M110.211 93.0923L100.168 101.553V200.092L111.168 191.632L110.211 93.0923Z" fill="#2C9B63" stroke="#1E1E1E"/>
        <path d="M99.918 200.092L0.917969 150.419V51.0923L99.918 100.765V200.092Z" fill="#2C9B63" stroke="#242424" strokeMiterlimit="10"/>
        <path d="M11.418 42.5923L0.917969 51.0923L99.918 100.592L110.418 92.5923L11.418 42.5923Z" fill="#2C9B63" stroke="#1E1E1E"/>
      </svg>
    ),
  },
  {
    title: 'Run + observe locally',
    description:
    "Steps create traces that survive refactors, correlate across multiple languages, and even follow workflows across platforms. Because these traces carry the same IDs as your code, it’s incredibly easy to debug, test, and mock steps before you deploy.",
    icon: (
      <svg width="250" height="178" viewBox="0 0 250 178" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M248.707 95.0488L215.733 111.539L141.207 81.0451L174.181 64.5488L248.707 95.0488Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M248.181 128.523L215.207 145.013V112.039L248.181 95.5488V128.523Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M215.207 145.049L141.207 113.88V80.5488L215.207 111.718V145.049Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M174.707 31.0488L141.733 47.5391L67.207 17.0451L100.181 0.548828L174.707 31.0488Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M174.181 64.5232L141.207 81.0134V48.0391L174.181 31.5488V64.5232Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M141.207 81.0488L67.207 49.8801V16.5488L141.207 47.7176V81.0488Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M215.707 111.049L182.733 127.539L108.207 97.0451L141.181 80.5488L215.707 111.049Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M215.181 144.523L182.207 161.013V128.039L215.181 111.549V144.523Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M182.207 161.049L108.207 129.88V96.5488L182.207 127.718V161.049Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M141.707 47.0488L108.733 63.5391L34.207 33.0451L67.1814 16.5488L141.707 47.0488Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M141.181 80.5232L108.207 97.0134V64.0391L141.181 47.5488V80.5232Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M108.207 97.0488L34.207 65.8801V32.5488L108.207 63.7176V97.0488Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M182.707 127.049L149.733 143.539L75.207 113.045L108.181 96.5488L182.707 127.049Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M182.181 160.523L149.207 177.013V144.039L182.181 127.549V160.523Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M149.207 177.049L75.207 145.88V112.549L149.207 143.718V177.049Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M108.707 63.0488L75.7327 79.5391L1.20703 49.0451L34.1814 32.5488L108.707 63.0488Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M108.181 96.5232L75.207 113.013V80.0391L108.181 63.5488V96.5232Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M75.207 113.049L1.20703 81.8801V48.5488L75.207 79.7176V113.049Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
      </svg>
    ),
  },
  {
    title: 'Refactor without breaking',
    description:
    "Update your code, test locally with mocked steps, and ship to production without breaking or migrating long-running code. Query by step name, replay, and debug easily—all because step identity is clear from the start.",
    icon: (
      <svg width="159" height="161" viewBox="0 0 159 161" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M67.072 86.5376L34.0976 103.028L1.11719 86.5376L34.0976 70.0474L67.072 86.5376Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M67.0759 119.508L34.1016 135.998V103.024L67.0759 86.5337V119.508Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M34.0976 135.998L1.11719 119.508V86.5337L34.0976 103.024V135.998Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M157.359 86.5376L124.385 103.028L91.4102 86.5376L124.385 70.0474L157.359 86.5376Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M157.361 119.508L124.387 135.998V103.024L157.361 86.5337V119.508Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M124.385 135.998L91.4102 119.508V86.5337L124.385 103.024V135.998Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M110.8 109.824L77.8259 126.314L44.8516 109.824L77.8259 93.3335L110.8 109.824Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M110.799 142.8L77.8242 159.296V126.316L110.799 109.826V142.8Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M77.8259 159.296L44.8516 142.8V109.826L77.8259 126.316V159.296Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M110.8 17.0493L77.8259 33.5395L44.8516 17.0493L77.8259 0.559082L110.8 17.0493Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M110.799 50.0246L77.8242 66.521V33.5405L110.799 17.0503V50.0246Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M77.8259 66.521L44.8516 50.0246V17.0503L77.8259 33.5405V66.521Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M67.072 40.1499L34.0976 56.6401L1.11719 40.1499L34.0976 23.6597L67.072 40.1499Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M67.0759 73.1262L34.1016 89.6164V56.6421L67.0759 40.1519V73.1262Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M34.0976 89.6164L1.11719 73.1262V40.1519L34.0976 56.6421V89.6164Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M157.363 40.1499L124.388 56.6401L91.4141 40.1499L124.388 23.6597L157.363 40.1499Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M157.365 73.1262L124.391 89.6164V56.6421L157.365 40.1519V73.1262Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M124.388 89.6164L91.4141 73.1262V40.1519L124.388 56.6421V89.6164Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M110.8 63.449L77.8259 79.9392L44.8516 63.449L77.8259 46.9526L110.8 63.449Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M110.799 96.4192L77.8242 112.909V79.9351L110.799 63.4448V96.4192Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M77.8259 112.909L44.8516 96.4192V63.4448L77.8259 79.9351V112.909Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
      </svg>

    ),
  },
  {
    title: 'Extend anywhere',
    description:
    "Extend workflows with custom middleware for logging, tracing, metrics, and/or security features. Fit your existing stack, or build for new use cases.",
    icon: (
      <svg width="241" height="165" viewBox="0 0 241 165" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M106.072 43.5376L73.0976 60.0278L40.1172 43.5376L73.0976 27.0474L106.072 43.5376Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M106.076 76.5081L73.1016 92.9983V60.0239L106.076 43.5337V76.5081Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M73.0976 92.9983L40.1172 76.5081V43.5337L73.0976 60.0239V92.9983Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M67.072 67.0493L34.0976 83.5395L1.11719 67.0493L34.0976 50.5591L67.072 67.0493Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M67.0759 100.02L34.1016 116.51V83.5356L67.0759 67.0454V100.02Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M34.0976 116.51L1.11719 100.02V67.0454L34.0976 83.5356V116.51Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M196.359 43.5376L163.385 60.0278L130.41 43.5376L163.385 27.0474L196.359 43.5376Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M196.361 76.5081L163.387 92.9983V60.0239L196.361 43.5337V76.5081Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M163.385 92.9983L130.41 76.5081V43.5337L163.385 60.0239V92.9983Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M239.066 69.0493L206.092 85.5395L173.117 69.0493L206.092 52.5591L239.066 69.0493Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M239.068 102.02L206.094 118.51V85.5356L239.068 69.0454V102.02Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M206.092 118.51L173.117 102.02V69.0454L206.092 85.5356V118.51Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M149.8 66.8237L116.826 83.3139L83.8516 66.8237L116.826 50.3335L149.8 66.8237Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M149.799 99.8L116.824 116.296V83.3159L149.799 66.8257V99.8Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M116.826 116.296L83.8516 99.8V66.8257L116.826 83.3159V116.296Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M149.8 17.0493L116.826 33.5395L83.8516 17.0493L116.826 0.559082L149.8 17.0493Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M149.799 50.0256L116.824 66.522V33.5415L149.799 17.0513V50.0256Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M116.826 66.522L83.8516 50.0256V17.0513L116.826 33.5415V66.522Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M108.066 92.0493L75.0915 108.54L42.1172 92.0493L75.0915 75.5591L108.066 92.0493Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M108.064 125.026L75.0898 141.522V108.542L108.064 92.0513V125.026Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M75.0915 141.522L42.1172 125.026V92.0513L75.0915 108.542V141.522Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M199.066 89.0493L166.092 105.54L133.117 89.0493L166.092 72.5591L199.066 89.0493Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M199.064 122.026L166.09 138.522V105.542L199.064 89.0513V122.026Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M166.092 138.522L133.117 122.026V89.0513L166.092 105.542V138.522Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M156.066 114.049L123.092 130.54L90.1172 114.049L123.092 97.5591L156.066 114.049Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M156.064 147.026L123.09 163.522V130.542L156.064 114.051V147.026Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
        <path d="M123.092 163.522L90.1172 147.026V114.051L123.092 130.542V163.522Z" fill="#2C9B63" stroke="#242424" stroke-miterlimit="10"/>
      </svg>

    ),
  },
];

function Home() {
  const [selectedFeature, setSelectedFeature] = useState(workflowFeatures[0]);

  return (
    <div className="min-h-screen">

      <div className="bg-[#181818] text-white bg-[url('/img/bg.png')] bg-cover bg-center bg-no-repeat ">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 pt-8 pb-8">
          <Header />
        </div>

        {/* Hero */}
        <section className="relative w-full overflow-hidden min-h-[500px]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#181818]/70 via-transparent to-[#181818]/40" aria-hidden="true" />

          <div className="relative z-10 max-w-[1400px] mx-auto px-6 sm:px-10">
            <div className="pt-20 pb-32 max-w-4xl">
              <h1 className="text-4xl sm:text-5xl mb-8 leading-tight font-light font-mono">
                THE [ OPEN ]
                <br />
                WORKFLOW SDK
              </h1>
              <p className="max-w-md mb-6 leading-loose">
                <span className="border border-white px-2 py-1 text-[0.8em] mr-2">STEPKIT</span>
                is an open source SDK for building production ready durable workflows that run anywhere.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 font-semibold font-mono">
                <Link
                  to="/docs/$"
                  params={{ _splat: '' }}
                  className="inline-flex justify-center items-center border border-[#2C9B63] py-2 px-4 bg-[#2C9B63] text-[#181818] hover:opacity-90 transition-opacity cursor-pointer"
                >
                  READ_THE_DOCS [→]
                </Link>
                <a
                  className="inline-flex justify-center items-center py-2 px-4 border border-[#2C9B63] text-[#2C9B63] hover:opacity-90 transition-opacity cursor-pointer"
                  href="https://www.npmjs.com/package/stepkit"
                  target="_blank"
                  rel="noreferrer"
                >
                  NPM I STEPRUN @ LATEST [→]
                </a>
              </div>
            </div>

            {/*
            <div className="w-full py-8 flex flex-wrap gap-8 justify-end text-right uppercase tracking-[0.3em] text-xs opacity-70">
              <span>netlify</span>
              <span>inngest</span>
              <span>cloudflare</span>
              <span>turbostack</span>
              <span>convex</span>
            </div>
            */}
          </div>
        </section>
      </div>

      <div className="bg-[#E2E2E2] text-[#242424]">

        <div className="max-w-[1400px] mx-auto space-y-16 pb-16 px-6 sm:px-10">

          {/* Testimonial */}

          {/*
          <SectionRule name="What developers say" border={false} className="py-14" />
          <blockquote className="text-xl sm:text-2xl md:text-3xl leading-relaxed font-light font-mono">
            "LOREM IPSUM DOLOR SIT AMET, CONSECTETUR ADIPISCING ELIT, SED DO EIUSMOD TEMPOR INCIDIDUNT UT LABORE ET
            DOLORE MAGNA ALIQUA. UT ENIM AD MINIM VENIAM."
          </blockquote>
          <div className="flex items-center space-x-4 text-xl">
            <span className="cursor-pointer">←</span>
            <span className="cursor-pointer">→</span>
          </div>
          */}


          <SectionRule name="About StepKit" className="pt-14" />

          {/* About StepKit */}
          <section className="bg-[#E2E2E2] text-[#242424] pt-8 -mx-6 sm:-mx-10 px-6 sm:px-10">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24">
              <div className="space-y-6">
                <p className="leading-relaxed">
                  StepKit is an open source SDK built on top of the explicit step standard. This format was pioneered by
                  as a method for building workflows with the most flexibility and least infrastructure overhead.
                </p>
                <p className="leading-relaxed">
                  By using IDs for every step, functions remain stable and observable regardless of how your code
                  evolves. <span className="underline">StepKit was built for iteration.</span>
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 mt-8 " unused="border-t-[0.5px] border-t-[#242424] ">
                  <div className="space-y-6">
                    <p className="uppercase pt-2 font-mono text-sm">This means you&nbsp;can:</p>
                  </div>
                  <div className="space-y-6">
                    <ol className="space-y-4 text-sm">
                      {[
                        'Choose any orchestration provider or language',
                        'Deploy durable workflows anywhere',
                        'Suspend and resume long running flows',
                        'Safely refactor without breaking',
                        'Mock and test workflows before deployment',
                      ].map((text, index) => (
                          <li key={text} className="flex gap-3 items-start pb-4">
                            <span className="text-[14px] leading-none border border-[#242424] rounded-full w-10 h-10 flex items-center justify-center shrink-0 font-mono">{`0${index + 1}`}</span>
                            <span className="text-sm pt-2">→</span>
                            <p className="pt-2">{text}</p>
                          </li>
                        ))}
                    </ol>
                  </div>
                </div>
              </div>

              

              <div className="bg-[#1e1e1e] px-1 text-xs text-white overflow-auto border border-gray-800 rounded">
                <SyntaxHighlighter
                  language="typescript"
                  style={vscDarkPlus}
                  showLineNumbers
                  customStyle={{ lineHeight: '1.8' }}
                  codeTagProps={{ style: { fontSize: '0.7rem' } }}
                >
                  {`import { Client } from "@stepkit/inngest";

const client = new Client();

client.workflow({ id: "research-agent" }, async (ctx, step) => {
  const msg = await step.run("call-llm", async () => {
    // Run any code in a step.
  });

  await step.run("call-tool", async () => {
    // Chain steps together without worrying about
    // state, retries, or durability.
  });
});`}
                </SyntaxHighlighter>
              </div>
            </div>
          </section>

          <SectionRule name="Why use the StepKit SDK" className="pt-12" />

          {/* Why StepKit */}
          <section className="px-0 py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-24 sm:px-10 md:pl-52 md:pr-0">
              {[
                {
                  id: '001',
                  title: (
                    <>
                      PLATFORM &<br />LANGUAGE AGNOSTIC
                    </>
                  ),
                  icon: <PlatformLanguageIcon />,
                  body:
                  'Write (and re-write) functions using multiple languages, or migrate platforms entirely without ' +
                    'impacting long running functions — using the same step format. No vendor lock-in, no language lock-in.',
                },
                {
                  id: '002',
                  title: (
                    <>
                      FASTER FIXES,
                      <br />
                      FEARLESS REFACTORING
                    </>
                  ),
                  icon: <RefactoringIcon />,
                  body:
                  'Steps create traces with the same IDs, so you can see what is broken and why. Update code, test ' +
                    'locally with mocked steps, and ship to production without breaking or migrating code.',
                },
                {
                  id: '003',
                  title: (
                    <>
                      EXTENSIBLE
                      <br />
                      CORE & MIDDLEWARE
                    </>
                  ),
                  icon: <ExtensibleIcon />,
                  body:
                  'Extend workflows with custom middleware for logging, tracing, metrics, and security features. ' +
                    'Explore new extensions and fit into your existing stack from day one.',
                },
              ].map((card) => (
                  <div key={card.id} className="space-y-4">

                    <div className="h-[140px] w-full flex items-center justify-center overflow-visible px-2 [&>svg]:h-full [&>svg]:w-auto [&>svg]:overflow-visible">
                      {card.icon ?? <div className="w-16 h-16 bg-gray-700" />}
                    </div>

                    <p className="text-xs border-t-[1.5px] border-t-[#242424] py-2 mt-8 font-mono">{card.id}</p>

                    <h3 className="text-xl leading-snug font-mono">{card.title}</h3>
                    <p className="text-sm leading-relaxed">{card.body}</p>
                    <Link
                      to="/docs/$"
                      params={{ _splat: '' }}
                      className="text-xs underline transition-colors"
                    >
                      READ_DOCS →
                    </Link>
                  </div>
                ))}
            </div>
          </section>
        </div>
      </div>


      <div className="bg-[#181818] text-white">
        <div className="relative max-w-[1400px] mx-auto pt-8 pb-32 px-6 sm:px-10 overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[url('/img/connect.svg')] bg-no-repeat bg-right bg-contain opacity-50"
          />

          {/* Testimonial */}
          <SectionRule name="Run workflows on any infrastructure" border={false} className="relative z-10 py-14" />

          <div className="relative z-10 space-y-4">
            <p className="mt-8">Run functions on any cloud provider, using drivers for orchestration.</p>

            <p className="my-2">[<Tick />] Server</p>
            <p className="my-2">[<Tick />] Serverless</p>
            <p className="my-2">[<Tick />] Containers & K8S</p>
          </div>

        </div>
      </div>

      <div className="bg-[#E2E2E2] text-[#242424]">
        <div className="max-w-[1400px] mx-auto pt-8 pb-4 px-6 sm:px-10">
          <SectionRule name="Build reliable workflows" border={false} className="pt-14 pb-10" />

          <p className="text-base leading-relaxed md:max-w-[33%] pb-2">
            StepKit allows you to effortlessly build reliable workflows without worrying about queues, state, or infrastructure.  It runs on any platform, without requiring bundler or runtime support. 
          </p>

          <div className="flex flex-wrap gap-3 py-12 md:justify-center">
            {workflowFeatures.map((feature) => {
              const isActive = selectedFeature.id === feature.id;

              return (
                <span
                  key={feature.id}
                  onClick={() => setSelectedFeature(feature)}
                  className={`inline-flex items-center rounded-full border border-[#24242480] px-4 py-2 text-sm tracking-wide uppercase transition-colors cursor-pointer font-mono ${
isActive
? "bg-[#242424] text-white after:ml-2 after:text-base after:-mt-[2px] after:content-['■']"
: 'text-[#242424] bg-transparent hover:bg-white/40'
}`}
                >
                  {feature.id} - {feature.label}
                </span>
              );
            })}

            <div className="w-full pt-16 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-24 items-start">
              <div className="space-y-4">
                <h2 className="text-xl sm:text-2xl font-semibold uppercase tracking-wide mb-4 sm:mb-8">
                  {selectedFeature.id} — {selectedFeature.label}
                </h2>
                <p className="text-sm leading-relaxed text-[#242424]">{selectedFeature.description}</p>
              </div>
              <div className="md:col-span-2 bg-[#1e1e1e] px-1 text-xs text-white overflow-auto border border-gray-800 rounded">
                <SyntaxHighlighter
                  language="typescript"
                  style={vscDarkPlus}
                  showLineNumbers
                  customStyle={{ lineHeight: '1.8' }}
                  codeTagProps={{ style: { fontSize: '0.7rem' } }}
                >
                  {selectedFeature.code}
                </SyntaxHighlighter>
              </div>
            </div>

          </div>
        </div>
      </div>

      <div className="bg-[#0c0c0c]">
        <marquee className="text-2xl sm:text-3xl md:text-4xl pt-6 pb-5 opacity-30 text-[#FEFEFE] font-mono">
          <span className="relative -top-[3px] inline-block leading-none">&nbsp;■&nbsp;</span> BUILD&nbsp;
          <span className="relative -top-[3px] inline-block leading-none">&nbsp;■&nbsp;</span> ITERATE&nbsp;
          <span className="relative -top-[3px] inline-block leading-none">&nbsp;■&nbsp;</span> EXTEND&nbsp;
          <span className="relative -top-[3px] inline-block leading-none">&nbsp;■&nbsp;</span> BUILD&nbsp;
          <span className="relative -top-[3px] inline-block leading-none">&nbsp;■&nbsp;</span> ITERATE&nbsp;
          <span className="relative -top-[3px] inline-block leading-none">&nbsp;■&nbsp;</span> EXTEND&nbsp;
          <span className="relative -top-[3px] inline-block leading-none">&nbsp;■&nbsp;</span> BUILD&nbsp;
          <span className="relative -top-[3px] inline-block leading-none">&nbsp;■&nbsp;</span> ITERATE&nbsp;
          <span className="relative -top-[3px] inline-block leading-none">&nbsp;■&nbsp;</span> EXTEND&nbsp;
          <span className="relative -top-[3px] inline-block leading-none">&nbsp;■&nbsp;</span> BUILD&nbsp;
          <span className="relative -top-[3px] inline-block leading-none">&nbsp;■&nbsp;</span> ITERATE&nbsp;
          <span className="relative -top-[3px] inline-block leading-none">&nbsp;■&nbsp;</span> EXTEND&nbsp;
        </marquee>
      </div>

      <div className="bg-[#2C9B63] text-[#242424] pt-8">
        <div className="max-w-[1400px] mx-auto space-y-16 pb-16 px-6 sm:px-10">
          <SectionRule name="How it works" className="py-14" />

          <section className="px-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-24 sm:px-10 md:pl-52 md:pr-0">

              {howItWorksSteps.map((step, index) => (
                <div key={step.title} className="space-y-6">
                  <div className="h-[200px] flex items-center">{step.icon}</div>

                  <span className="border-t-[1.5px] border-t-[#242424] block pt-4 mt-6 text-xs uppercase tracking-[0.5em] font-mono">
                    STEP — {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="uppercase text-xl pb-4 font-mono">
                    {step.title}
                  </h3>
                  <p>{step.description}</p>
                  <Link
                    to="/docs/$"
                    params={{ _splat: '' }}
                    className="inline-flex items-center text-xs uppercase tracking-[0.3em] underline font-mono"
                  >
                    READ_DOCS →
                  </Link>
                </div>
              ))}

              <div className="text-5xl sm:text-6xl md:text-8xl opacity-25 leading-[1.3]">
                <a href="https://www.github.com/stepkit/stepkit" className="underline">
                  GIT
                  HUB <br />
                  <span className="inline-block relative -left-[12px]">[<UpArrow />]</span>
                </a>
              </div>

            </div>
          </section>
        </div>
      </div>

      <div className="bg-[#181818] text-white">
        <div className="relative max-w-[1400px] mx-auto pt-8 pb-32 px-6 sm:px-10 overflow-hidden">
          {/* Testimonial */}
          <SectionRule name="Why we built StepKit" border={false} className="relative z-10 py-14" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24">
            <div className="relative z-10 space-y-4 max-w-full md:max-w-[80%]">
              <p className="">Code is being written and re-written faster than ever. </p>
              <p className="mt-4">Other workflows weren't built to expect this pace of change.</p>
            </div>
            <div className="relative z-10 space-y-4">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 pb-10 border-t-[0.5px] border-t-[#484848]">
                <div className="flex align-top">
                  <span className="text-sm sm:text-base">[ 01 ] →</span>
                  <h2 className="inline-block text-2xl sm:text-3xl md:text-4xl ml-4 sm:ml-6">BUILD</h2>
                </div>
                <p className="opacity-50 text-sm sm:text-base">Choose any orchestration provider or language</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 pb-10 border-t-[0.5px] border-t-[#484848]">
                <div className="flex align-top">
                  <span className="text-sm sm:text-base">[ 02 ] →</span>
                  <h2 className="inline-block text-2xl sm:text-3xl md:text-4xl ml-4 sm:ml-6">ITERATE</h2>
                </div>
                <p className="opacity-50 text-sm sm:text-base">Deploy durable workflows anywhere, in seconds</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 pb-10 border-y-[0.5px] border-y-[#484848]">
                <div className="flex align-top">
                  <span className="text-sm sm:text-base">[ 03 ] →</span>
                  <h2 className="inline-block text-2xl sm:text-3xl md:text-4xl ml-4 sm:ml-6">EXTEND</h2>
                </div>
                <p className="opacity-50 text-sm sm:text-base">Suspend and resume long running workflows</p>
              </div>

            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24 pt-16 md:pt-32">
            <div className="relative z-10 space-y-4">
              <h2 className="text-xl sm:text-2xl">StepKit</h2>

              <div className="opacity-70">
                <p className="text-sm">For an increasingly AI-dependent world, flexibility and iteration is paramount. We built StepKit to give developers  the peace  of mind they need to deploy quickly, refactor fearlessly, and  most importantly—change languages, or re-write entire workflows without breaking or migrating code. No language lock-in. No vendor lock-in.</p>
                <p className="text-sm">One open source foundation for every engineer.</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/*
      <div className="bg-[#2C9B63] text-[#242424] pt-8">
        <div className="max-w-[1400px] mx-auto space-y-16 pb-16 sm:px-10">
          <SectionRule name="FAQs" border={false}  className="pt-8" />
        </div>
      </div>
      */}

      <div className="bg-[#181818] text-white">
        <div className="relative max-w-[1400px] mx-auto pt-8 pb-32 px-6 sm:px-10 overflow-hidden">

          <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-16 md:pt-32">
            <p className="font-mono text-sm sm:text-base">USE STEP KIT [ TODAY ]</p>
            <a
              href="https://www.npmjs.com/package/stepkit"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center py-2 px-4 sm:px-6 border border-[#2C9B63] text-[#2C9B63] hover:opacity-90 transition-opacity cursor-pointer font-mono text-xs sm:text-sm whitespace-nowrap"
            >
              npm i inngest/stepkit@latest
            </a>
          </div>

          <div className="pt-8 md:pt-16 flex justify-center md:justify-start">
            <a
              href="/docs"
              className="inline-flex items-center py-2 px-4 sm:px-6 border bg-[#080808] border-[#080808] text-[#818181] hover:opacity-90 transition-opacity cursor-pointer font-mono text-sm"
            >
              Get started [→]
            </a>
          </div>

          <div className="mt-8 py-6 border-t-[1px] border-t-[#555555]">
            <span className="text-xs sm:text-sm opacity-50 font-mono uppercase">©2025 Inngest. |   Inngest.com</span>

            <svg width="180" height="31" viewBox="0 0 180 31" fill="none" xmlns="http://www.w3.org/2000/svg" className="mt-6 max-w-full h-auto">
              <path d="M5.18621 0.541016H0V30.1675H5.18621V0.541016Z" fill="#FEFEFE"/>
              <path d="M110.97 24.6777C109.97 24.6777 107.213 24.1429 107.88 20.3163C108.136 19.015 109.612 15.4796 107.838 10.3457C107.397 9.09196 107.266 5.97245 110.911 5.97245H124.873V0.505859H102.926L102.967 30.1383H125.344V24.6777H110.982H110.976H110.97Z" fill="#FEFEFE"/>
              <path d="M118.003 12.6758H114.865C113.371 12.6758 112.156 13.8998 112.156 15.4031C112.156 16.9064 113.365 18.1305 114.865 18.1305H118.003C119.498 18.1305 120.713 16.9064 120.713 15.4031C120.713 13.8998 119.504 12.6758 118.003 12.6758Z" fill="#FEFEFE"/>
              <path d="M58.5595 0.541099L58.7143 10.8741C58.7143 12.9063 58.8513 14.9503 59.9468 16.5962C62.2929 20.1376 59.3157 22.4787 57.2376 20.1376L42.3995 0.535156H35.6711L35.683 21.0824C35.683 21.9202 34.9983 23.0611 33.5335 22.966C31.509 22.8412 31.8782 18.7769 28.7105 15.0394C28.639 14.9562 17.7188 0.541099 17.7188 0.541099H11.2227V30.1676H16.8852V21.1715C16.8852 18.8601 16.9269 15.8178 15.7777 14.1957C13.8664 11.498 15.2835 9.48966 16.9686 9.70357C17.7486 9.85806 18.4036 10.7434 18.4036 10.7434L33.0452 30.1617H41.292V20.0841C41.4468 15.901 40.0237 13.3698 39.9106 13.0429C39.4461 11.6585 39.8451 10.6781 40.5775 10.2621C41.2682 9.86995 42.2089 9.87589 42.9175 10.678C43.3998 11.2306 57.3805 30.1557 57.3805 30.1557H64.2221V0.54704H58.5535L58.5595 0.541099Z" fill="#FEFEFE"/>
              <path d="M144.758 12.984C142.96 12.5681 140.507 12.0927 138.119 11.5104C134.344 10.5954 133.945 5.48529 141.15 5.49123C146.973 5.49123 149.76 9.98928 149.76 9.98928L152.945 5.48529C152.945 5.48529 148.795 -0.0704272 141.245 0.0246439C131.057 0.161309 129.771 6.06165 129.706 8.28394C129.7 8.52162 129.384 13.4237 134.302 15.9669C136.315 17.0126 140.435 17.6544 142.537 18.0644C144.151 18.3852 145.3 18.819 145.854 19.3122C148.271 21.4513 147.128 25.9137 140.941 25.4383C134.773 24.963 131.861 20.2332 131.861 20.2332L128.574 24.8501C128.574 24.8501 132.022 30.388 140.739 30.8098C153.416 31.4219 156.226 19.639 150.057 15.1053C149.414 14.6359 147.825 13.6911 144.758 12.9781V12.984Z" fill="#FEFEFE"/>
              <path d="M179.878 5.75119V0.540107H173.947C171.72 0.557933 170.768 1.05111 170.22 1.29473C169.16 1.7998 168.094 2.40588 165.951 1.34227C165.439 1.12242 164.182 0.510398 162.069 0.540107H156.18V5.75713H163.367C164.385 5.75713 165.206 6.57712 165.212 7.59319L165.242 30.1666H170.78L170.75 7.59913C170.75 6.58306 171.572 5.75713 172.596 5.75713H179.878V5.75119Z" fill="#FEFEFE"/>
              <path d="M82.6961 13.7021V18.3428H91.0322C90.1926 24.2193 84.8397 25.1938 83.3154 25.1938C78.7067 25.1938 74.0802 22.3655 74.0802 15.3837C74.0802 12.4187 76.0392 5.59731 83.3392 5.59731C85.2863 5.59731 88.5016 5.8231 92.36 9.4774L96.0695 5.18731C94.5631 3.64241 90.4665 0 83.3392 0C74.9198 0 68.1914 6.04889 68.1914 15.348C68.1914 24.6472 74.366 30.7911 83.3094 30.7911C89.5912 30.7911 93.4258 26.2693 93.4258 24.2015V30.1197H98.0702V13.7853L82.6902 13.6962L82.6961 13.7021Z" fill="#FEFEFE"/>
            </svg>

          </div>

        </div>
      </div>



    </div>
  );
}

const Tick = () => {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline">
      <path d="M5.104 11.456L0 4.8L1.104 3.92L5.168 9.2L12.112 0L13.184 0.864L5.104 11.456Z" fill="#FEFEFE"/>
    </svg>
  )
}

const UpArrow = () => {
  return (
    <svg width="54" height="54" viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block relative top-[-6px]">
      <path d="M4.68698 53.6601L-0.000780973 48.8726L43.5854 5.28636L41.2914 2.99235C38.1995 5.08688 35.0078 6.58297 29.8214 6.58297H14.1622V0.000156224H53.6591V39.3973H47.0763V24.1371C47.0763 18.6515 48.5724 15.4598 50.6669 12.3679L48.3729 10.0739L4.68698 53.6601Z" fill="#242424"/>
    </svg>

  )
}
