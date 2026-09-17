import { z } from "zod";
import { sanitizePhone } from "@/lib/sanitize";

const optionalDate = z
  .string()
  .trim()
  .max(32)
  .optional()
  .refine((v) => !v || /^\d{4}(-\d{2}(-\d{2})?)?$/.test(v), {
    message: "Data w formacie RRRR, RRRR-MM lub RRRR-MM-DD.",
  });

export const personFieldPatchSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  maidenName: z.string().trim().max(80).optional(),
  gender: z.enum(["male", "female", "unknown"]).optional(),
  birthDate: optionalDate,
  deathDate: optionalDate,
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? sanitizePhone(v) : undefined)),
  notes: z.string().trim().max(2000).optional(),
});

export const changeKindSchema = z.enum([
  "correction",
  "missing_person",
  "photo",
  "dates",
  "relatives",
  "graph_edit",
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

export const newPersonSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  gender: z.enum(["male", "female", "unknown"]),
  birthDate: optionalDate,
  deathDate: optionalDate,
  maidenName: z.string().trim().max(80).optional(),
});

export const graphMutationSchema = z
  .object({
    op: z.enum(["add_child", "link_spouse", "reparent"]),
    anchorPersonId: z.string().trim().min(1).max(120),
    relatedPersonId: z.string().trim().max(120).optional(),
    newPerson: newPersonSchema.optional(),
    secondParentId: z.string().trim().max(120).optional(),
    replaceParentIds: z.boolean().optional().default(true),
    reporterName: z.string().trim().min(1).max(120).optional(),
    reporterPersonId: z.string().trim().max(120).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.relatedPersonId && !v.newPerson) {
      ctx.addIssue({
        code: "custom",
        message: "Wybierz istniejącą osobę albo podaj dane nowej.",
        path: ["relatedPersonId"],
      });
    }
    if (v.relatedPersonId && v.newPerson) {
      ctx.addIssue({
        code: "custom",
        message: "Podaj albo istniejącą osobę, albo nową.",
        path: ["relatedPersonId"],
      });
    }
  });

export const submissionPayloadSchema = z
  .object({
    kind: changeKindSchema.default("other"),
    reporterName: z.string().trim().min(1).max(120),
    reporterPersonId: z.string().trim().max(120).optional(),
    reporterPhone: z
      .string()
      .trim()
      .max(40)
      .optional()
      .transform((v) => (v ? sanitizePhone(v) : undefined)),
    targetPersonId: z.string().trim().max(120).optional(),
    targetPersonName: z.string().trim().max(160).optional(),
    message: z.string().trim().max(4000).default(""),
    self: z
      .object({
        firstName: z.string().trim().min(1).max(80),
        lastName: z.string().trim().min(1).max(80),
        maidenName: z.string().trim().max(80).optional(),
        birthDate: optionalDate,
        gender: z.enum(["male", "female", "unknown"]).optional(),
        phone: z
          .string()
          .trim()
          .max(40)
          .optional()
          .transform((v) => (v ? sanitizePhone(v) : undefined)),
      })
      .optional(),
    relatives: z.array(relativeDraftSchema).max(20).optional(),
    graphEdit: z
      .object({
        op: z.enum(["add_child", "link_spouse", "reparent"]),
        anchorPersonId: z.string().trim().min(1).max(120),
        relatedPersonId: z.string().trim().max(120).optional(),
        secondParentId: z.string().trim().max(120).optional(),
        replaceParentIds: z.boolean().optional(),
        newPerson: newPersonSchema.optional(),
        summary: z.string().trim().max(500).optional(),
      })
      .optional(),
    correction: personFieldPatchSchema.optional(),
    photoUrl: z.string().trim().url().max(2000).optional(),
    photoAction: z.enum(["set", "remove"]).optional(),
  })
  .refine(
    (v) =>
      Boolean(v.message?.trim()) ||
      Boolean(v.self?.firstName) ||
      Boolean(v.graphEdit) ||
      Boolean(v.correction) ||
      Boolean(v.photoUrl) ||
      v.photoAction === "remove",
    {
      message: "Dodaj opis zmiany albo swoje dane.",
    },
  );

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
    earlyArrival: z.boolean().optional().default(false),
    earlyArrivalOver7: z.coerce.number().int().min(0).max(20).optional().default(0),
    earlyArrivalUnder7: z.coerce.number().int().min(0).max(20).optional().default(0),
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
      earlyArrival: Boolean(v.earlyArrival),
      earlyArrivalOver7: v.earlyArrival ? (v.earlyArrivalOver7 ?? 0) : 0,
      earlyArrivalUnder7: v.earlyArrival ? (v.earlyArrivalUnder7 ?? 0) : 0,
    };
  });

export const adminPersonWriteSchema = z.object({
  action: z.enum(["update", "create", "delete", "graph"]),
  personId: z.string().trim().min(1).max(120).optional(),
  fields: personFieldPatchSchema.optional(),
  newPerson: newPersonSchema.extend({
    phone: z.string().trim().max(40).optional(),
    notes: z.string().trim().max(2000).optional(),
    deathDate: optionalDate,
    parentIds: z.array(z.string().trim().min(1).max(120)).max(4).optional(),
    spouseIds: z.array(z.string().trim().min(1).max(120)).max(8).optional(),
  }).optional(),
  graphEdit: graphMutationSchema.optional(),
});
