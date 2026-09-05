import { z } from "zod";

export const vehicleSchema = z
  .object({
    vehicleType: z.enum(["Car", "SUV", "Van", "Bike", "Other"], {
      required_error: "Please select a vehicle type",
    }),
    fuelType: z.enum(["Petrol", "Diesel", "CNG", "Electric", "Hybrid"]).default("Petrol").optional(),
    engineCapacity: z.string().trim().max(50).optional().default(""),
    make: z.string().trim().max(50).optional().default(""),
    color: z.string().trim().max(30).optional().default(""),
    vehicleModel: z
      .string({ required_error: "Vehicle model is required" })
      .trim()
      .min(2, "Vehicle model must be at least 2 characters")
      .max(100, "Vehicle model cannot exceed 100 characters"),
    registrationNumber: z
      .string({ required_error: "Registration plate number is required" })
      .trim()
      .toUpperCase()
      .regex(
        /^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{1,3}[ -]?[0-9]{1,4}$/,
        "Registration plate number must be in standard Indian format (e.g. TN 07 AB 1234, TN 38 BK 5678, KA 01 MN 2468)"
      ),
    seatingCapacity: z.coerce
      .number({ required_error: "Seating capacity is required" })
      .int("Must be a whole number")
      .min(1, "Capacity must be at least 1")
      .max(20, "Capacity cannot exceed 20"),
    availableSeats: z.coerce
      .number({ required_error: "Available seats are required" })
      .int("Must be a whole number")
      .min(1, "Available seats must be at least 1")
      .max(20, "Available seats cannot exceed 20"),
    vehiclePhoto: z.string().optional().or(z.literal("")),
    numberPlatePhoto: z.string().optional().or(z.literal("")),
    drivingLicensePhoto: z.string().optional().or(z.literal("")),
    status: z.enum(["active", "inactive"]).default("active"),
  })
  .refine((data) => data.availableSeats <= data.seatingCapacity, {
    message: "Available seats cannot exceed total seating capacity",
    path: ["availableSeats"],
  });

export type VehicleInput = z.infer<typeof vehicleSchema>;
