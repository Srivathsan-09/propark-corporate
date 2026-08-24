import mongoose from "mongoose";
import Campus from "@/models/Campus";
import User from "@/models/User";

export async function ensureCampusMasterData() {
  try {
    // Drop redundant collections if they exist in Atlas
    if (mongoose.connection.db) {
      try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        const colNames = collections.map((c) => c.name);

        if (colNames.includes("campuscompanies")) {
          await mongoose.connection.db.dropCollection("campuscompanies");
          console.log(" [Cleanup] Dropped legacy 'campuscompanies' collection.");
        }
        if (colNames.includes("companies")) {
          await mongoose.connection.db.dropCollection("companies");
          console.log(" [Cleanup] Dropped legacy 'companies' collection.");
        }
      } catch (dropErr) {
        // Non-fatal if already dropped
      }
    }

    // 1. Seed Master Physical Campuses with their operating companies
    const campusesData = [
      {
        campusId: "CAMP001",
        name: "Tech Park Chennai",
        address: "OMR IT Expressway, Sholinganallur",
        city: "Chennai",
        state: "Tamil Nadu",
        companies: [
          "Tech Mahindra",
          "Infosys",
          "Comcast",
          "HCL",
        ],
        status: "active" as const,
      },
      {
        campusId: "CAMP002",
        name: "Business Hub Bangalore",
        address: "EPIP Zone, Whitefield",
        city: "Bangalore",
        state: "Karnataka",
        companies: [
          "ABC Technologies",
          "TCS",
          "Infosys",
          "Wipro",
        ],
        status: "active" as const,
      },
      {
        campusId: "CAMP003",
        name: "Cyber City Hyderabad",
        address: "Hitec City, Madhapur",
        city: "Hyderabad",
        state: "Telangana",
        companies: [
          "ABC Technologies",
          "Microsoft",
          "Google India",
        ],
        status: "active" as const,
      },
    ];

    for (const c of campusesData) {
      await Campus.updateOne(
        { campusId: c.campusId },
        { $set: c },
        { upsert: true }
      );
    }

    // 2. Ensure existing employee accounts follow ascending EMP-001, EMP-002... format
    try {
      const nonAdminUsers = await User.find({ role: { $ne: "admin" } })
        .sort({ createdAt: 1 })
        .select("_id employeeId");

      let index = 1;
      for (const u of nonAdminUsers) {
        const formattedId = `EMP-${String(index).padStart(3, "0")}`;
        if (u.employeeId !== formattedId && (!u.employeeId || u.employeeId.startsWith("EMP-") || u.employeeId.startsWith("EMP"))) {
          await User.updateOne({ _id: u._id }, { $set: { employeeId: formattedId } });
        }
        index++;
      }
    } catch (empErr) {
      console.error("Employee ID formatting sync error:", empErr);
    }

    console.log(" [Seed] Master Campuses & Companies initialized successfully.");
  } catch (error) {
    console.error(" [Seed] Error initializing campus master data:", error);
  }
}
