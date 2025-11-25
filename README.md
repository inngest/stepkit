<p align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="./images/logo-dark.svg"/>
        <img alt="StepKit logo" src="./images/logo-light.svg"/>
    </picture>
</p>
<p align="center">
    <a href="https://step.run/docs">Documentation</a>
    <span>&nbsp;·&nbsp;</span>
    <a href="https://step.run/blog">Blog</a>
    <span>&nbsp;·&nbsp;</span>
    <a href="https://github.com/inngest/stepkit/discussions">Community</a>
    <span>&nbsp;·&nbsp;</span>
    <a href="https://github.com/inngest/stepkit/discussions/categories/roadmap">Roadmap / RFCs</a>
</p>
<br/>

StepKit lets you write durable workflows using the standard steps API and deploy to multiple drivers (Inngest, Cloudflare, Netlify) without refactoring.

StepKit's steps bring:

- 🦾 **Durability**: write unbreakable code that automatically retries without any state loss
- 🕑 **Suspend and Resume**: write code that can pause for weeks without using compute
- 📊 **Observability**: each workflow step becomes a live trace with detailed logs and metadata
- 🪝 **Native webhooks and _"Human in the Loop"_**: make your workflow wait for an external event

Visit the [step.run documentation](https://step.run/docs) for guides and examples.

## Get started

1. Install StepKit with your preferred driver

_Inngest, Cloudflare, Netlify for local dev and deployment, or In-Memory/FileSystem for testing_

```bash
npm i @stepkit/inngest

# npm i @stepkit/cloudflare
# npm i @stepkit/local
```

2. Write your first durable workflow

```ts
import { z } from "zod";
import { Client } from "@stepkit/inngest";
// import { Client } from "@stepkit/cloudflare";
// import { FileSystemClient as Client } from "@stepkit/local";

import { emailTemplates, sendEmail } from "./email-service";

export const client = new Client({ id: "readme-example" });

export const onboardingWorkflow = client.workflow(
  {
    id: "onboarding-workflow",
    inputSchema: z.object({
      userId: z.string(),
      email: z.email(),
      userName: z.string(),
    }),
  },
  async ({ input }, step) => {
    const { userId, email, userName } = input.data;

    // DAY 1: Welcome Email
    await step.run("send-welcome-email", async () => {
      const template = emailTemplates.welcome(userName);
      return await sendEmail(email, template);
    });

    // Wait 3 days
    await step.sleep("wait-for-day-3", 3600 * 24 * 3)

    // DAY 3: Feedback Email
    await step.run("send-feedback-request", async () => {
      const template = emailTemplates.feedbackRequest(userName, 7);
      return await sendEmail(email, template);
    });
  }
);
```

## Community

Welcome to the StepKit community!

Whether you’re here to ask questions, share ideas, or collaborate on code, you’ll find all the action is happening in [the GitHub Discussions](https://github.com/inngest/stepkit/).

Please take a moment to review our [Code of Conduct](./CODE_OF_CONDUCT.md) to understand our shared values and the standards of behavior that help keep our community safe and respectful for everyone.



## Contributing

If you're new to contributing, you will find all the essential information (_architecture overview, etc_) in the ["Welcome to the StepKit Community!" discussion thread](https://github.com/inngest/stepkit/discussions/45) before getting started.

We encourage you to open issues and submit pull requests!


## License

[Apache 2.0](./LICENSE.md)
