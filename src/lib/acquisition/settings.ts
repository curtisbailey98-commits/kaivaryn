import { prisma } from "@/lib/prisma";

export async function getAcquisitionSettings() {
  let config = await prisma.acquisitionSettings.findUnique({ where: { key: "default" } });
  if (!config) {
    config = await prisma.acquisitionSettings.create({ data: { key: "default" } });
  }
  return config;
}

export async function updateAcquisitionSettings(input: {
  weightIcpFit?: number;
  weightIntent?: number;
  weightPain?: number;
  weightEconomicValue?: number;
  weightDecisionMakerAccess?: number;
  weightTiming?: number;
  priorityThreshold?: number;
  nurtureThreshold?: number;
  icpMinEmployees?: number;
  icpMaxEmployees?: number;
  icpMinRevenueUsd?: number;
  icpMaxRevenueUsd?: number;
}) {
  await getAcquisitionSettings(); // ensure the row exists first
  return prisma.acquisitionSettings.update({ where: { key: "default" }, data: input });
}
