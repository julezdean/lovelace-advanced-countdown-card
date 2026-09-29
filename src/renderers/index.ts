import { registerRenderer } from "../core/registry";
import { barRenderer } from "./bar";
import { circleRenderer } from "./circle";
import { digitalRenderer } from "./digital";
import { numericRenderer } from "./numeric";
import { radialRenderer } from "./radial";
import { segmentsRenderer } from "./segments";

registerRenderer(circleRenderer);
registerRenderer(radialRenderer);
registerRenderer(barRenderer);
registerRenderer(segmentsRenderer);
registerRenderer(digitalRenderer);
registerRenderer(numericRenderer);
