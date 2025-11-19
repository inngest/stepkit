import { InMemoryClient } from "../../src/main";
import { parallelStepSuite } from "../common/parallelSteps";
import { stepInvokeWorkflowSuite } from "../common/step.invoke";
import { stepRunSuite } from "../common/step.run";
import { stepSleepSuite } from "../common/step.sleep";
import { stepWaitForSignalSuite } from "../common/step.waitForSignal";

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

parallelStepSuite(
  () => new InMemoryClient(),
  (client) => client.stop()
);
