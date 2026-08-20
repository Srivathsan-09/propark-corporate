import User from "@/models/User";

/**
 * Returns the next sequential Employee ID in ascending order: EMP-001, EMP-002, EMP-003...
 */
export async function getNextEmployeeId(): Promise<string> {
  const users = await User.find({ employeeId: { $regex: /^EMP-\d+$/i } })
    .select("employeeId")
    .lean();

  let maxNum = 0;
  for (const u of users) {
    const match = u.employeeId.match(/^EMP-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `EMP-${String(nextNum).padStart(3, "0")}`;
}

/**
 * Normalizes an employee ID to uppercase 3-digit padded format: EMP-001
 */
export function formatEmployeeId(rawId: string): string {
  const trimmed = rawId.trim();
  const match = trimmed.match(/^EMP-?(\d+)$/i);
  if (match) {
    const num = parseInt(match[1], 10);
    return `EMP-${String(num).padStart(3, "0")}`;
  }
  return trimmed.toUpperCase();
}
