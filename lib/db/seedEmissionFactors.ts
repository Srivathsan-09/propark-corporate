import { connectToDatabase } from "./mongodb";
import EmissionFactor from "@/models/EmissionFactor";

export const DEFAULT_EMISSION_FACTORS = [
  {
    factorId: "PETROL_CAR_SMALL",
    vehicleType: "Car" as const,
    fuelType: "Petrol" as const,
    engineCategory: "<=1200cc" as const,
    gramsCO2PerKm: 126.37,
    source: "IPCC 2006 / MoEFCC India GHG Platform",
    sourceReference: "India GHG Platform - Road Transport CO2 Emission Factors for Light Duty Vehicles",
    isActive: true,
  },
  {
    factorId: "PETROL_CAR_LARGE",
    vehicleType: "Car" as const,
    fuelType: "Petrol" as const,
    engineCategory: ">1200cc" as const,
    gramsCO2PerKm: 172.95,
    source: "IPCC 2006 / MoEFCC India GHG Platform",
    sourceReference: "India GHG Platform - Heavy/Higher-Displacement Petrol Passenger Cars",
    isActive: true,
  },
  {
    factorId: "PETROL_CAR_DEFAULT",
    vehicleType: "Car" as const,
    fuelType: "Petrol" as const,
    engineCategory: "default" as const,
    gramsCO2PerKm: 142.50,
    source: "IPCC 2006 / MoEFCC India GHG Platform",
    sourceReference: "India GHG Platform - Average Petrol Passenger Vehicle Baseline",
    isActive: true,
  },
  {
    factorId: "DIESEL_CAR_DEFAULT",
    vehicleType: "Car" as const,
    fuelType: "Diesel" as const,
    engineCategory: "default" as const,
    gramsCO2PerKm: 118.50,
    source: "IPCC 2006 / MoEFCC India GHG Platform",
    sourceReference: "India GHG Platform - Diesel Light-Duty Passenger Cars",
    isActive: true,
  },
  {
    factorId: "PETROL_SUV_DEFAULT",
    vehicleType: "SUV" as const,
    fuelType: "Petrol" as const,
    engineCategory: "default" as const,
    gramsCO2PerKm: 210.00,
    source: "IPCC 2006 / MoEFCC India GHG Platform",
    sourceReference: "India GHG Platform - Sport Utility Vehicles (Petrol)",
    isActive: true,
  },
  {
    factorId: "DIESEL_SUV_DEFAULT",
    vehicleType: "SUV" as const,
    fuelType: "Diesel" as const,
    engineCategory: "default" as const,
    gramsCO2PerKm: 185.00,
    source: "IPCC 2006 / MoEFCC India GHG Platform",
    sourceReference: "India GHG Platform - Sport Utility Vehicles (Diesel)",
    isActive: true,
  },
  {
    factorId: "CNG_CAR_DEFAULT",
    vehicleType: "Car" as const,
    fuelType: "CNG" as const,
    engineCategory: "default" as const,
    gramsCO2PerKm: 95.00,
    source: "IPCC 2006 / MoEFCC India GHG Platform",
    sourceReference: "India GHG Platform - Compressed Natural Gas Passenger Fleet",
    isActive: true,
  },
  {
    factorId: "ELECTRIC_DEFAULT",
    vehicleType: "Car" as const,
    fuelType: "Electric" as const,
    engineCategory: "default" as const,
    gramsCO2PerKm: 0.00,
    source: "Zero Direct Tailpipe Emission Baseline",
    sourceReference: "Bureau of Energy Efficiency (BEE) - Zero Tailpipe Benchmark",
    isActive: true,
  },
  {
    factorId: "BIKE_PETROL_DEFAULT",
    vehicleType: "Bike" as const,
    fuelType: "Petrol" as const,
    engineCategory: "default" as const,
    gramsCO2PerKm: 72.00,
    source: "IPCC 2006 / MoEFCC India GHG Platform",
    sourceReference: "India GHG Platform - Motorized Two-Wheelers Average",
    isActive: true,
  },
  {
    factorId: "VAN_DIESEL_DEFAULT",
    vehicleType: "Van" as const,
    fuelType: "Diesel" as const,
    engineCategory: "default" as const,
    gramsCO2PerKm: 230.00,
    source: "IPCC 2006 / MoEFCC India GHG Platform",
    sourceReference: "India GHG Platform - Commercial Passenger Vans & Minivans",
    isActive: true,
  },
  {
    factorId: "GLOBAL_DEFAULT",
    vehicleType: "Other" as const,
    fuelType: "Petrol" as const,
    engineCategory: "default" as const,
    gramsCO2PerKm: 130.00,
    source: "IPCC 2006 / MoEFCC India GHG Platform",
    sourceReference: "Weighted National Urban Commuter Vehicle Baseline",
    isActive: true,
  },
];

export async function ensureDefaultEmissionFactors() {
  await connectToDatabase();

  const count = await EmissionFactor.countDocuments();
  if (count === 0) {
    console.log(" Seeding initial IPCC/MoEFCC carbon emission factors...");
    await EmissionFactor.insertMany(DEFAULT_EMISSION_FACTORS);
    console.log(" Seeded default emission factors successfully.");
  }
}
