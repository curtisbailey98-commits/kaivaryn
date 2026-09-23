"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { redirect } from "next/navigation";
import { syncDemoToAcquisition } from "@/lib/acquisition";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  company: z.string().min(1).max(200),
  title: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  products: z.array(z.string()).min(1),
  companySize: z.string().max(40).optional(),
  message: z.string().max(2000).optional(),
  zoomLink: z
    .string()
    .max(500)
    .optional()
    .refine(
      (v) => !v || /^https?:\/\//i.test(v),
      "Preferred meeting link must be a valid http(s) URL"
    ),
});

export type DemoFormState = { error?: string } | null;

export async function submitDemoRequest(
  _prev: DemoFormState,
  formData: FormData
): Promise<DemoFormState> {
  const products = formData.getAll("products").map(String);
  const zoomRaw = String(formData.get("zoomLink") || "").trim();
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company"),
    title: formData.get("title") || undefined,
    phone: formData.get("phone") || undefined,
    products,
    companySize: formData.get("companySize") || undefined,
    message: formData.get("message") || undefined,
    zoomLink: zoomRaw || undefined,
  });
  if (!parsed.success) {
    return { error: "Please complete required fields with a valid email." };
  }
  const data = parsed.data;
  const created = await prisma.demoRequest.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      company: data.company,
      title: data.title,
      phone: data.phone,
      products: data.products.join(","),
      companySize: data.companySize,
      message: data.message,
      zoomLink: data.zoomLink || null,
      status: "NEW",
    },
  });
  try {
    await syncDemoToAcquisition(created.id);
  } catch (error) {
    console.error("Failed to sync demo request into acquisition engine", error);
  }
  await writeAudit({
    action: "demo_request.created",
    entityType: "DemoRequest",
    entityId: created.id,
    metadata: { email: data.email, company: data.company },
  });
  redirect("/demo/thank-you");
}
