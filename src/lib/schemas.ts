import { z } from 'zod';

export const ScheduleConsultationSchema = z.object({
  hostName: z.string().min(2, { message: "Host name must be at least 2 characters." }),
  date: z.date({ required_error: "Consultation date is required." }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid start time format (HH:MM)." }),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid end time format (HH:MM)." }),
  roomName: z.string().min(3, { message: "Room name must be at least 3 characters." }).regex(/^[a-zA-Z0-9_-]+$/, { message: "Room name can only contain letters, numbers, underscores, and hyphens." }),
  clientEmails: z.string().min(1, { message: "At least one client email is required." })
    .refine(emails => emails.split(',').every(email => z.string().email().safeParse(email.trim()).success), {
      message: "Please provide a comma-separated list of valid email addresses."
    }),
}).refine(data => {
  // Basic time validation: end time should be after start time
  // This doesn't account for date changes, assuming same day consultation for simplicity here
  const [startH, startM] = data.startTime.split(':').map(Number);
  const [endH, endM] = data.endTime.split(':').map(Number);
  return endH > startH || (endH === startH && endM > startM);
}, {
  message: "End time must be after start time.",
  path: ["endTime"],
});

export type ScheduleConsultationFormData = z.infer<typeof ScheduleConsultationSchema>;

export const VerifyEmailSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});
export type VerifyEmailFormData = z.infer<typeof VerifyEmailSchema>;

export const EnterNameSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
});
export type EnterNameFormData = z.infer<typeof EnterNameSchema>;
