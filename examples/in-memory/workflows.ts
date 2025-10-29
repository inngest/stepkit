import { client } from './client';

export const workflow1 = client.workflow(
  { id: 'workflow-1' },
  async ({ step }) => {
    console.log('workflow-1 executed');
    const name = await step.run('get-name', async () => {
      console.log('get-name executed');
      return 'Alice';
    });
    console.log('workflow-1 return');
    return `Hello, ${name}!`;
  }
);
