import { inngest } from '../client'
import { failJobOnRunCancelled } from '../runFailure'

// Inngest cancels (not fails) a run that exceeds its function-level
// timeouts.finish, which skips onFailure. Listen for the cancellation event and
// fail the in-flight track/pipeline so the job page shows why. The sweeper
// (sweeper.ts) remains the fallback if this event is ever not delivered.
export const failJobOnCancelledRun = inngest.createFunction(
  {
    id: 'fail-job-on-cancelled-run',
    triggers: [{ event: 'inngest/function.cancelled', if: "event.data.function_id.startsWith('freshcan-')" }],
  },
  async ({ event }) => {
    await failJobOnRunCancelled({ event: event as never })
  },
)
