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

export const rsvpPayloadSchema = z
  .object({
    fullName: z.string().trim().min(1).max(160),
    personId: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(40).optional(),
    adults: z.coerce.number().int().min(0).max(20).optional(),
    children3to12: z.coerce.number().int().min(0).max(20).optional().default(0),
    childrenUnder3: z.coerce.number().int().min(0).max(20).optional().default(0),
    /** @deprecated prefer adults + children fields */
    guests: z.coerce.number().int().min(1).max(20).optional(),
    notes: z.string().trim().max(1000).optional(),
    willTransfer: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    const children3 = v.children3to12 ?? 0;
    const childrenU3 = v.childrenUnder3 ?? 0;
    const adults =
      v.adults != null
        ? v.adults
        : v.guests != null && children3 + childrenU3 === 0
          ? v.guests
          : 0;
    const total = adults + children3 + childrenU3;
    if (total < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Wybierz co najmniej jedną osobę.",
        path: ["adults"],
      });
    }
    if (total > 20) {
      ctx.addIssue({
        code: "custom",
        message: "Maksymalnie 20 osób w jednym zapisie.",
        path: ["adults"],
      });
    }
  })
  .transform((v) => {
    const children3to12 = v.children3to12 ?? 0;
    const childrenUnder3 = v.childrenUnder3 ?? 0;
    const adults =
      v.adults != null
        ? v.adults
        : v.guests != null && children3to12 + childrenUnder3 === 0
          ? v.guests
          : 0;
    return {
      fullName: v.fullName,
      personId: v.personId,
      phone: v.phone,
      adults,
      children3to12,
      childrenUnder3,
      notes: v.notes,
      willTransfer: v.willTransfer,
    };
  });
