import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    // 1. Google OAuth Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: true,
    }),

    // 2. Corporate Credentials Provider
    CredentialsProvider({
      name: "Corporate Credentials",
      credentials: {
        email: { label: "Corporate Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Please enter your corporate email and password.");
        }

        await connectToDatabase();

        const normalizedEmail = credentials.email.trim().toLowerCase();
        const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");

        if (!user) {
          throw new Error("No account found with this corporate email address.");
        }

        if (!user.passwordHash) {
          throw new Error("This account was created with Google Sign-In. Please sign in with Google.");
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!isPasswordValid) {
          throw new Error("Invalid password. Please check your credentials.");
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          employeeId: user.employeeId,
          department: user.department,
          phone: user.phone,
          companyName: user.companyName || "ABC Technologies",
          campusId: user.campusId || "CAMP001",
            campusName: user.campusName || "Tech Park Chennai",
            role: user.role,
            verificationStatus: user.verificationStatus || (user.role === "admin" ? "approved" : "pending"),
            isApproved: user.isApproved ?? (user.role === "admin"),
            image: user.profileImage?.startsWith("http")
              ? user.profileImage
              : user.profileImage
              ? `/api/profile/${user._id}/avatar`
              : "",
          };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          if (!user?.email) return false;
          await connectToDatabase();
          const normalizedEmail = user.email.toLowerCase().trim();
          let dbUser = await User.findOne({ email: normalizedEmail });

          const ADMIN_EMAILS = ["srimana2006@gmail.com", "admin@propark.corporate.com"];
          const isAdminUser = ADMIN_EMAILS.includes(normalizedEmail);

          const Campus = (await import("@/models/Campus")).default;
          const managedCampus = await Campus.findOne({ adminEmail: normalizedEmail });
          const isCampusAdmin = Boolean(managedCampus);

          if (!dbUser) {
            // Generate sequential Employee ID in ascending order: EMP-001, EMP-002...
            const { getNextEmployeeId } = await import("@/lib/db/employeeSequence");
            const employeeId = isAdminUser
              ? "ADM-VATHSAN"
              : isCampusAdmin
              ? `ADM-${managedCampus?.campusId}`
              : await getNextEmployeeId();

            dbUser = await User.create({
              name: isAdminUser ? "Vathsan" : user.name || "Corporate User",
              email: normalizedEmail,
              employeeId,
              department: isAdminUser ? "Executive Management" : isCampusAdmin ? "Campus Administration" : "Engineering",
              companyName: isCampusAdmin && managedCampus?.companies[0] ? managedCampus.companies[0] : "ABC Technologies",
              campusId: managedCampus?.campusId || "CAMP001",
              campusName: managedCampus?.name || "Tech Park Chennai",
              phone: "",
              role: isAdminUser ? "admin" : isCampusAdmin ? "campus_admin" : "employee",
              verificationStatus: isAdminUser || isCampusAdmin ? "approved" : "pending",
              isApproved: isAdminUser || isCampusAdmin ? true : false,
              profileImage: user.image || "",
            });
          } else {
            if (!dbUser.profileImage && user.image) {
              dbUser.profileImage = user.image;
            }
            if (isAdminUser) {
              dbUser.name = "Vathsan";
              dbUser.role = "admin";
              dbUser.verificationStatus = "approved";
              dbUser.isApproved = true;
            } else if (isCampusAdmin && managedCampus) {
              dbUser.role = "campus_admin";
              dbUser.campusId = managedCampus.campusId;
              dbUser.campusName = managedCampus.name;
              dbUser.verificationStatus = "approved";
              dbUser.isApproved = true;
            }
            await dbUser.save();
          }

          // Populate user object so JWT callback receives latest verification details
          user.id = dbUser._id.toString();
          user.role = dbUser.role;
          user.employeeId = dbUser.employeeId;
          user.department = dbUser.department;
          user.phone = dbUser.phone;
          user.companyName = dbUser.companyName;
          user.campusId = dbUser.campusId;
          user.campusName = dbUser.campusName;
          user.verificationStatus = dbUser.verificationStatus || (isAdminUser || isCampusAdmin ? "approved" : "pending");
          user.isApproved = dbUser.isApproved ?? (isAdminUser || isCampusAdmin);

          return true;
        } catch (error) {
          console.error(" Google OAuth signIn error:", error);
          return false;
        }
      }

      return true;
    },

    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        token.id = user.id || (token.sub as string);
        token.role = user.role;
        token.employeeId = user.employeeId;
        token.department = user.department;
        token.phone = user.phone;
        token.companyName = user.companyName;
        token.campusId = user.campusId;
        token.campusName = user.campusName;
        token.verificationStatus = user.verificationStatus;
        token.isApproved = user.isApproved;
      }

      // Re-verify against MongoDB to guarantee valid database user _id
      if ((!token.id || token.verificationStatus !== "approved" || trigger === "update") && token.email) {
        try {
          await connectToDatabase();
          const dbUser = await User.findOne({ email: token.email.toLowerCase().trim() });
          if (dbUser) {
            token.id = dbUser._id.toString();
            token.role = dbUser.role;
            token.employeeId = dbUser.employeeId;
            token.department = dbUser.department;
            token.phone = dbUser.phone;
            token.companyName = dbUser.companyName;
            token.campusId = dbUser.campusId;
            token.campusName = dbUser.campusName;
            token.verificationStatus = dbUser.verificationStatus || (dbUser.role === "admin" ? "approved" : "pending");
            token.isApproved = dbUser.isApproved ?? (dbUser.role === "admin");
            if (dbUser.profileImage) {
              token.picture = dbUser.profileImage.startsWith("http")
                ? dbUser.profileImage
                : `/api/profile/${dbUser._id}/avatar`;
            } else {
              token.picture = "";
            }
          }
        } catch (e) {
          console.error("JWT sync error:", e);
        }
      }

      // Support dynamic session update when profile is modified
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        if (session.department) token.department = session.department;
        if (session.phone) token.phone = session.phone;
        if (session.companyName) token.companyName = session.companyName;
        if (session.campusId) token.campusId = session.campusId;
        if (session.image !== undefined) {
          token.picture = session.image.startsWith("data:") ? "" : session.image;
        }
        if (session.verificationStatus) token.verificationStatus = session.verificationStatus;
        if (session.isApproved !== undefined) token.isApproved = session.isApproved;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id || token.sub) as string;
        session.user.role = (token.role as "employee" | "admin" | "campus_admin") || "employee";
        session.user.employeeId = token.employeeId as string;
        session.user.department = token.department as string;
        session.user.phone = token.phone as string | undefined;
        session.user.companyName = token.companyName as string | undefined;
        session.user.campusId = token.campusId as string | undefined;
        session.user.campusName = token.campusName as string | undefined;
        session.user.verificationStatus = (token.verificationStatus as "pending" | "approved" | "rejected") || "pending";
        session.user.isApproved = Boolean(token.isApproved);
        session.user.image = (token.picture as string) || "";

        // Dynamically verify approval status in MongoDB Atlas on every session check
        if (session.user.email) {
          try {
            await connectToDatabase();
            const liveUser = await User.findOne({ email: session.user.email.toLowerCase().trim() })
              .select("isApproved verificationStatus role name employeeId companyName campusId campusName profileImage");
            if (liveUser) {
              const isSuper = session.user.email.toLowerCase().trim() === "srimana2006@gmail.com" || liveUser.role === "admin";
              const isCampusAdm = liveUser.role === "campus_admin";
              session.user.role = isSuper ? "admin" : isCampusAdm ? "campus_admin" : "employee";
              session.user.isApproved = isSuper || isCampusAdm || Boolean(liveUser.isApproved);
              session.user.verificationStatus = (isSuper || isCampusAdm) ? "approved" : (liveUser.verificationStatus || "pending");
              if (liveUser.name) session.user.name = liveUser.name;
              if (liveUser.employeeId) session.user.employeeId = liveUser.employeeId;
              if (liveUser.companyName) session.user.companyName = liveUser.companyName;
              if (liveUser.campusId) session.user.campusId = liveUser.campusId;
              if (liveUser.campusName) session.user.campusName = liveUser.campusName;
              if (liveUser.profileImage) {
                session.user.image = liveUser.profileImage.startsWith("http")
                  ? liveUser.profileImage
                  : `/api/profile/${liveUser._id}/avatar`;
              } else {
                session.user.image = "";
              }
            }
          } catch (e) {
            console.error("Session dynamic sync error:", e);
          }
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "propark_corporate_mobility_platform_super_secret_2026_key",
};
