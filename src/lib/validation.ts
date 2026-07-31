import { z } from "zod";

export const changeKindSchema = z.enum([
  "correction",
  "missing_person",
  "photo",
  "dates",
  "relatives",
  "other",
]);

export const relativeDraftSchema = z.object({
  relation: z.string().trim().min(1).max(80),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  maidenName: z.string().trim().max(80).optional(),
  birthDate: z.string().trim().max(32).optional(),
  deathDate: z.string().trim().max(32).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const submissionPayloadSchema = z
  .object({
    kind: changeKindSchema.default("other"),
    reporterName: z.string().trim().min(1).max(120),
    reporterPersonId: z.string().trim().max(120).optional(),
    reporterPhone: z.string().trim().max(40).optional(),
    targetPersonId: z.string().trim().max(120).optional(),
    targetPersonName: z.string().trim().max(160).optional(),
    message: z.string().trim().max(4000).default(""),
    self: z
      .object({
        firstName: z.string().trim().min(1).max(80),
        lastName: z.string().trim().min(1).max(80),
        maidenName: z.string().trim().max(80).optional(),
        birthDate: z.string().trim().max(32).optional(),
        gender: z.enum(["male", "female", "unknown"]).optional(),
        phone: z.string().trim().max(40).optional(),
      })
      .optional(),
    relatives: z.array(relativeDraftSchema).max(20).optional(),
  })
  .refine((v) => Boolean(v.message?.trim()) || Boolean(v.self?.firstName), {
    message: "Dodaj opis zmiany albo swoje dane.",
  });

export const rsvpPayloadSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  personId: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  guests: z.coerce.number().int().min(1).max(20),
  notes: z.string().trim().max(1000).optional(),
  willTransfer: z.boolean().default(false),
});
