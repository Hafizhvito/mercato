import { inventoryService } from "@/modules/inventory/service";
import { inngest } from "../client";

export const sweepExpiredInventoryFunction = inngest.createFunction(
  {
    id: "sweep-expired-inventory",
    triggers: [{ cron: "*/5 * * * *" }],
  },
  async ({ step }) => {
    const result = await step.run("sweep-expired-reservations", async () => {
      return inventoryService.sweepExpiredReservations();
    });

    return {
      sweptCount: result.sweptCount,
    };
  },
);
