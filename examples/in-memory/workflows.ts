import { client } from './client';

export const workflow1 = client.workflow(
  { id: 'workflow-1' },
  async ({ step }) => {
    const name = await step.run('get-name', async () => {
      return 'Alice';
    });
    return `Hello, ${name}!`;
  }
);
