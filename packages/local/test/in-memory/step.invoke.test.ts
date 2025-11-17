import { InMemoryClient } from "../../src/main";
import { stepInvokeWorkflowSuite } from "../common/step.invoke.suite";

stepInvokeWorkflowSuite(
  () => new InMemoryClient(),
  (client) => client.stop()
);
