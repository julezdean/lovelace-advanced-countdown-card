import { registerSource } from "../core/registry";
import { numericSource, percentageSource } from "./numeric";
import { templateSource } from "./template";
import { timerSource } from "./timer";
import { timestampSource } from "./timestamp";
import { attributeSource, stateSource } from "./value";

registerSource(timerSource);
registerSource(timestampSource);
registerSource(percentageSource);
registerSource(numericSource);
registerSource(stateSource);
registerSource(attributeSource);
registerSource(templateSource);
