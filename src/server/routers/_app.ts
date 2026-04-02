import { createTRPCRouter } from "../trpc";
import { userRouter } from "./user";
import { projectRouter } from "./project";
import { hardwareRouter } from "./hardware";
import { componentsRouter } from "./components";
import { projectHardwareRouter } from "./projectHardware";
import { signalRouter } from "./signal";
import { codesysRouter } from "./codesys";
import { feedbackRouter } from "./feedback";
import { exportRouter } from "./export";
import { importRouter } from "./import";
import { devtoolsRouter } from "./devtools";

export const appRouter = createTRPCRouter({
  user: userRouter,
  project: projectRouter,
  hardware: hardwareRouter,
  components: componentsRouter,
  projectHardware: projectHardwareRouter,
  signal: signalRouter,
  codesys: codesysRouter,
  feedback: feedbackRouter,
  export: exportRouter,
  import: importRouter,
  devtools: devtoolsRouter,
});

export type AppRouter = typeof appRouter;
