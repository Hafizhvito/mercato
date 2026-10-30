import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { sweepExpiredInventoryFunction } from "@/inngest/functions/inventory-sweeper";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sweepExpiredInventoryFunction],
});
