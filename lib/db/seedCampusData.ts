import Campus from "@/models/Campus";
import Company from "@/models/Company";
import CampusCompany from "@/models/CampusCompany";

export async function ensureCampusMasterData() {
  try {
    const campusCount = await Campus.countDocuments();
    if (campusCount > 0) {
      return; // Already initialized
    }

    console.log("🌱 [Seed] Populating Master Campuses and Company relationships in MongoDB Atlas...");

    // 1. Master Physical Campuses
    const campusesData = [
      {
        campusId: "CAMP001",
        name: "Tech Park Chennai",
        address: "OMR IT Expressway, Sholinganallur",
        city: "Chennai",
        state: "Tamil Nadu",
        status: "active" as const,
      },
      {
        campusId: "CAMP002",
        name: "Business Hub Bangalore",
        address: "EPIP Zone, Whitefield",
        city: "Bangalore",
        state: "Karnataka",
        status: "active" as const,
      },
      {
        campusId: "CAMP003",
        name: "Cyber City Hyderabad",
        address: "Hitec City, Madhapur",
        city: "Hyderabad",
        state: "Telangana",
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

    // 2. Master Companies
    const companiesData = [
      { companyId: "COMP001", name: "ABC Technologies", domain: "abctech.com", status: "active" as const },
      { companyId: "COMP002", name: "XYZ Solutions", domain: "xyzsolutions.com", status: "active" as const },
      { companyId: "COMP003", name: "LML Private Ltd", domain: "lmlcorp.com", status: "active" as const },
      { companyId: "COMP004", name: "Tech Mahindra", domain: "techmahindra.com", status: "active" as const },
      { companyId: "COMP005", name: "Infosys", domain: "infosys.com", status: "active" as const },
      { companyId: "COMP006", name: "TCS", domain: "tcs.com", status: "active" as const },
      { companyId: "COMP007", name: "Wipro", domain: "wipro.com", status: "active" as const },
      { companyId: "COMP008", name: "Microsoft", domain: "microsoft.com", status: "active" as const },
      { companyId: "COMP009", name: "Google India", domain: "google.com", status: "active" as const },
    ];

    for (const comp of companiesData) {
      await Company.updateOne(
        { companyId: comp.companyId },
        { $set: comp },
        { upsert: true }
      );
    }

    // 3. Campus-Company Memberships (The Unique Campus IDs)
    const campusCompaniesData = [
      // CAMPUS 1 (Tech Park Chennai)
      {
        campusCompanyId: "CAMP-ABC-001",
        campusId: "CAMP001",
        companyId: "COMP001",
        companyName: "ABC Technologies",
        campusName: "Tech Park Chennai",
        status: "active" as const,
      },
      {
        campusCompanyId: "CAMP-XYZ-001",
        campusId: "CAMP001",
        companyId: "COMP002",
        companyName: "XYZ Solutions",
        campusName: "Tech Park Chennai",
        status: "active" as const,
      },
      {
        campusCompanyId: "CAMP-LML-001",
        campusId: "CAMP001",
        companyId: "COMP003",
        companyName: "LML Private Ltd",
        campusName: "Tech Park Chennai",
        status: "active" as const,
      },
      {
        campusCompanyId: "CAMP-TM-001",
        campusId: "CAMP001",
        companyId: "COMP004",
        companyName: "Tech Mahindra",
        campusName: "Tech Park Chennai",
        status: "active" as const,
      },
      {
        campusCompanyId: "CAMP-INF-002",
        campusId: "CAMP001",
        companyId: "COMP005",
        companyName: "Infosys",
        campusName: "Tech Park Chennai",
        status: "active" as const,
      },

      // CAMPUS 2 (Business Hub Bangalore)
      {
        campusCompanyId: "CAMP-ABC-002",
        campusId: "CAMP002",
        companyId: "COMP001",
        companyName: "ABC Technologies",
        campusName: "Business Hub Bangalore",
        status: "active" as const,
      },
      {
        campusCompanyId: "CAMP-TCS-001",
        campusId: "CAMP002",
        companyId: "COMP006",
        companyName: "TCS",
        campusName: "Business Hub Bangalore",
        status: "active" as const,
      },
      {
        campusCompanyId: "CAMP-INF-001",
        campusId: "CAMP002",
        companyId: "COMP005",
        companyName: "Infosys",
        campusName: "Business Hub Bangalore",
        status: "active" as const,
      },
      {
        campusCompanyId: "CAMP-WIP-001",
        campusId: "CAMP002",
        companyId: "COMP007",
        companyName: "Wipro",
        campusName: "Business Hub Bangalore",
        status: "active" as const,
      },

      // CAMPUS 3 (Cyber City Hyderabad)
      {
        campusCompanyId: "CAMP-ABC-003",
        campusId: "CAMP003",
        companyId: "COMP001",
        companyName: "ABC Technologies",
        campusName: "Cyber City Hyderabad",
        status: "active" as const,
      },
      {
        campusCompanyId: "CAMP-MSFT-001",
        campusId: "CAMP003",
        companyId: "COMP008",
        companyName: "Microsoft",
        campusName: "Cyber City Hyderabad",
        status: "active" as const,
      },
      {
        campusCompanyId: "CAMP-GOOG-001",
        campusId: "CAMP003",
        companyId: "COMP009",
        companyName: "Google India",
        campusName: "Cyber City Hyderabad",
        status: "active" as const,
      },
    ];

    for (const cc of campusCompaniesData) {
      await CampusCompany.updateOne(
        { campusCompanyId: cc.campusCompanyId },
        { $set: cc },
        { upsert: true }
      );
    }

    console.log("✅ [Seed] Master Campuses, Companies, and Campus IDs seeded successfully.");
  } catch (error) {
    console.error("⚠️ [Seed] Error initializing campus master data:", error);
  }
}
