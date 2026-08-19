import Link from "next/link";
import { ParkingSquare, Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ParkingPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto py-8">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-purple-700 border-purple-300 bg-purple-50 text-xs">
          Upcoming Module • Phase 5
        </Badge>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Campus Parking Management</h1>
        <p className="text-sm text-slate-500 mt-1">
          Real-time parking zone availability, occupancy heatmaps, and priority carpool reservation stalls.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="text-center py-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 mb-3 ring-8 ring-purple-50/50">
            <ParkingSquare className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-900">
            Campus Parking Module Coming in Phase 5
          </CardTitle>
          <CardDescription className="max-w-md mx-auto text-sm text-slate-500 mt-2">
            In Phase 5, CommuteX will link completed carpools directly with freed campus parking stalls and priority parking allocations.
          </CardDescription>
        </CardHeader>
        <CardContent className="border-t border-slate-100 p-6 flex flex-col sm:flex-row items-center justify-center gap-4 bg-slate-50/50">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              Back to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
