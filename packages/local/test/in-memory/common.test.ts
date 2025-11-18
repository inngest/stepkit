import { InMemoryClient } from "../../src/main";
import { stepInvokeWorkflowSuite } from "../common/step.invoke";
import { stepRunSuite } from "../common/step.run";
import { stepSleepSuite } from "../common/step.sleep";
import { stepWaitForSignalSuite } from "../common/step.waitForSignal";
import { workflowSuite } from "../common/workflow";

stepInvokeWorkflowSuite(
  () => new InMemoryClient(),
  (client) => client.stop()
);

stepRunSuite(
  () => new InMemoryClient(),
  (client) => client.stop()
);

stepSleepSuite(
  () => new InMemoryClient(),
  (client) => client.stop()
);

stepWaitForSignalSuite(
  () => new InMemoryClient(),
  (client) => client.stop()
);

workflowSuite(
  () => new InMemoryClient(),
  (client) => client.stop()
);
