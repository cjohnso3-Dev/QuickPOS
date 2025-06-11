import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ShoppingCart, ScanBarcode, Settings } from "lucide-react";

export default function Navigation() {
  const [location, setLocation] = useLocation();

  return (
    <header className="bg-white shadow-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-4">
            <div className="bg-primary text-white p-2 rounded-lg">
              <ScanBarcode className="text-xl" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">VendorPOS</h1>
          </div>
          
          {/* Navigation Tabs */}
          <nav className="hidden md:flex space-x-1 bg-slate-100 p-1 rounded-lg">
            <Button
              variant={location === "/" ? "default" : "ghost"}
              size="sm"
              onClick={() => setLocation("/")}
              className={location === "/" ? "tab-button active" : "tab-button"}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Customer Ordering
            </Button>
            <Button
              variant={location === "/admin" ? "default" : "ghost"}
              size="sm"
              onClick={() => setLocation("/admin")}
              className={location === "/admin" ? "tab-button active" : "tab-button"}
            >
              <Settings className="w-4 h-4 mr-2" />
              Admin Dashboard
            </Button>
          </nav>

          {/* Store Info */}
          <div className="flex items-center space-x-4">
            <div className="bg-slate-100 px-3 py-2 rounded-lg">
              <span className="text-sm text-slate-600">Store: </span>
              <span className="text-sm font-medium text-slate-900">Main Location</span>
            </div>
            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center">
              <span className="text-sm font-medium">A</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
