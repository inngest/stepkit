import { Inngest } from "inngest";

//
// Create an Inngest client for your app
export const inngest = new Inngest({
  id: "open-workflow-example",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
