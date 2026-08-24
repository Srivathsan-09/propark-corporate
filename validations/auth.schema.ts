import { z } from "zod";

export const registerSchema = z
  .object({
    name: z
      .string({ required_error: "Full name is required" })
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name cannot exceed 100 characters"),
    employeeId: z
      .string({ required_error: "Emp Id is required" })
      .trim()
      .min(3, "Emp Id must be at least 3 characters")
      .max(30, "Emp Id cannot exceed 30 characters")
      .regex(/^[A-Za-z0-9_-]+$/, "Emp Id can only contain letters, numbers, hyphens, and underscores"),
    email: z
      .string({ required_error: "Corporate email is required" })
      .trim()
      .toLowerCase()
      .email("Please enter a valid email address"),
    phone: z
      .string({ required_error: "Phone number is required" })
      .trim()
      .min(7, "Phone number must be at least 7 digits")
      .max(15, "Phone number cannot exceed 15 digits")
      .regex(/^[+]?[0-9\s-]{7,15}$/, "Please enter a valid phone number"),
    department: z
      .string({ required_error: "Department is required" })
      .trim()
      .min(2, "Department must be at least 2 characters")
      .max(50, "Department cannot exceed 50 characters"),
    companyName: z
      .string({ required_error: "Company / Organization is required" })
      .trim()
      .min(2, "Company name must be at least 2 characters")
      .max(100, "Company name cannot exceed 100 characters"),
    campusId: z
      .string({ required_error: "Campus ID is required" })
      .trim()
      .min(3, "Campus ID must be at least 3 characters")
      .max(50, "Campus ID cannot exceed 50 characters")
      .regex(/^[A-Za-z0-9_-]+$/, "Campus ID can only contain letters, numbers, hyphens, and underscores"),
    password: z
      .string({ required_error: "Password is required" })
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password cannot exceed 100 characters"),
    confirmPassword: z
      .string({ required_error: "Please confirm your password" })
      .min(6, "Confirm password must be at least 6 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address"),
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
