import { defineHtmlProject } from 'playground';
import { createStopwatchModel } from './models';
import { StopwatchView } from './views';

// The project: a model of a stopwatch, and a view of it, made of HTML
// elements, in the root. The playground ticks what `start` returns, then
// updates and refreshes the views. Change anything, and the project runs
// again.
export const project = defineHtmlProject({
    start: ({ root }) => {
        const model = createStopwatchModel();
        root.append(StopwatchView({
            elapsedMs: () => model.elapsedMs,
            isRunning: () => model.isRunning,
            onStartOrStopPressed: () => model.startOrStop(),
            onResetPressed: () => model.reset(),
        }));
        return model;
    },
});
