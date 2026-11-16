import { GetDashboardResponse } from "@workspace/api-zod";
import { z } from "zod";

const followUpJob = GetDashboardResponse.shape.follow_up_required.unwrap().element;

export const DashboardResponse = GetDashboardResponse.extend({
  follow_up_required: z.array(
    followUpJob._def.left.extend({ property_id: z.string().uuid().nullable() }).and(followUpJob._def.right),
  ).optional(),
});
