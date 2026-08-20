import NextAuth, { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "employee" | "admin" | "campus_admin";
      employeeId: string;
      department: string;
      phone?: string;
      companyName?: string;
      campusCompanyId?: string;
      campusId?: string;
      companyId?: string;
      campusName?: string;
      verificationStatus: "pending" | "approved" | "rejected";
      isApproved: boolean;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    role: "employee" | "admin" | "campus_admin";
    employeeId: string;
    department: string;
    phone?: string;
    companyName?: string;
    campusCompanyId?: string;
    campusId?: string;
    companyId?: string;
    campusName?: string;
    verificationStatus: "pending" | "approved" | "rejected";
    isApproved: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "employee" | "admin" | "campus_admin";
    employeeId?: string;
    department?: string;
    phone?: string;
    companyName?: string;
    campusCompanyId?: string;
    campusId?: string;
    companyId?: string;
    campusName?: string;
    verificationStatus?: "pending" | "approved" | "rejected";
    isApproved?: boolean;
  }
}
