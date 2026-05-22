import { z } from "zod";

export const walletAdjustmentSchema = z.object({
  userEmail: z.string().email({ message: "Please enter a valid user email." }),
  walletType: z.enum(["cashback", "amazon_rewards"]),
  type: z.enum(["credit", "debit"]),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, {
      message: "Enter a valid amount with up to 2 decimal places.",
    }),
});

export const withdrawalRequestSchema = z.object({
  upiId: z
    .string()
    .trim()
    .min(5, { message: "UPI ID is required." })
    .max(100, { message: "UPI ID is too long." })
    .regex(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/, {
      message: "Please enter a valid UPI ID.",
    }),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, {
      message: "Enter a valid amount with up to 2 decimal places.",
    }),
});

export const amazonGiftCardRequestSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, {
      message: "Enter a valid amount with up to 2 decimal places.",
    }),
});

export const adminWithdrawalDecisionSchema = z.object({
  requestId: z.string().trim().regex(/^\d+$/, {
    message: "Invalid request ID.",
  }),
  decision: z.enum(["approve", "reject", "mark-paid"]),
  note: z.string().trim().max(250).optional(),
});

export const adminAmazonGiftCardDecisionSchema = z.object({
  requestId: z.string().trim().regex(/^\d+$/, {
    message: "Invalid request ID.",
  }),
  decision: z.enum(["approve", "reject", "fulfill"]),
  note: z.string().trim().max(250).optional(),
  giftCardCode: z.string().trim().max(100).optional(),
});

export const adminTrackedClickSchema = z.object({
  clickId: z.string().uuid({ message: "Invalid click ID." }),
});

export const adminApproveClickSchema = z.object({
  clickId: z.string().uuid({ message: "Invalid click ID." }),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, {
      message: "Enter a valid amount with up to 2 decimal places.",
    }),
  walletType: z.enum(["cashback", "amazon_rewards"]).optional(),
});

export const adminDeleteClickSchema = z.object({
  clickId: z.string().uuid({ message: "Invalid click ID." }),
});

export const adminSendAlertSchema = z
  .object({
    recipientType: z.enum(["all", "single"]),
    userEmail: z.string().trim().optional(),
    message: z.string().trim().min(2).max(300),
  })
  .superRefine((value, ctx) => {
    if (value.recipientType === "single") {
      const emailValidation = z.string().email().safeParse(value.userEmail ?? "");
      if (!emailValidation.success) {
        ctx.addIssue({
          code: "custom",
          path: ["userEmail"],
          message: "Valid user email is required for single-recipient alert.",
        });
      }
    }
  });
