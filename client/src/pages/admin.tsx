import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ProductModal from "@/components/ProductModal";
import PosAdminDashboard from "@/components/PosAdminDashboard";
import type { ProductWithCategory, OrderWithDetails, Setting } from "@shared/schema";
import { 
  DollarSign, 
  ShoppingBag, 
  AlertTriangle, 
  Package, 
  Plus, 
  Edit, 
  Trash2, 
  TrendingUp,
  Settings as SettingsIcon
} from "lucide-react";

export default function AdminPage() {
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const { toast } = useToast();

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["/api/products"],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
  });

  const { data: orders = [] } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders"],
  });

  const { data: settings = [] } = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete product");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Product deleted",
        description: "Product has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openProductModal = (product?: ProductWithCategory) => {
    setSelectedProduct(product || null);
    setShowProductModal(true);
  };

  const getStockStatus = (product: ProductWithCategory) => {
    if (product.stock <= (product.minStock || 5)) {
      return { label: "Low Stock", variant: "destructive" as const };
    }
    if (product.stock > (product.maxStock || 100)) {
      return { label: "Overstocked", variant: "secondary" as const };
    }
    return { label: "In Stock", variant: "default" as const };
  };

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(numAmount);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">POS Admin Dashboard</h1>
      
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Comprehensive Dashboard */}
        <TabsContent value="dashboard">
          <PosAdminDashboard />
        </TabsContent>

        {/* Products Management */}
        <TabsContent value="products">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Product Management</CardTitle>
                <Button onClick={() => openProductModal()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Product</th>
                      <th className="text-left py-2">Category</th>
                      <th className="text-left py-2">Price</th>
                      <th className="text-left py-2">Stock</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product: ProductWithCategory) => {
                      const stockStatus = getStockStatus(product);
                      return (
                        <tr key={product.id} className="border-b">
                          <td className="py-2">
                            <div className="flex items-center space-x-3">
                              {product.imageUrl && (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="w-10 h-10 rounded object-cover"
                                />
                              )}
                              <div>
                                <div className="font-medium">{product.name}</div>
                                <div className="text-sm text-gray-500">{product.sku}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2">
                            {product.category?.name || "Uncategorized"}
                          </td>
                          <td className="py-2">{formatCurrency(product.price)}</td>
                          <td className="py-2">{product.stock}</td>
                          <td className="py-2">
                            <Badge variant={stockStatus.variant}>
                              {stockStatus.label}
                            </Badge>
                          </td>
                          <td className="py-2">
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openProductModal(product)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteProductMutation.mutate(product.id)}
                                disabled={deleteProductMutation.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Management */}
        <TabsContent value="inventory">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Low Stock Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {products
                    .filter((product: ProductWithCategory) => product.stock <= (product.minStock || 5))
                    .map((product: ProductWithCategory) => (
                      <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          <div>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-muted-foreground">
                              Current: {product.stock} • Min: {product.minStock || 5}
                            </div>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => openProductModal(product)}>
                          Update Stock
                        </Button>
                      </div>
                    ))}
                  {products.filter((product: ProductWithCategory) => product.stock <= (product.minStock || 5)).length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      All products are adequately stocked
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Total Products</div>
                    <div className="text-2xl font-bold">{products.length}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Low Stock Items</div>
                    <div className="text-2xl font-bold text-red-600">
                      {products.filter((product: ProductWithCategory) => product.stock <= (product.minStock || 5)).length}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Total Inventory Value</div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(
                        products.reduce((total: number, product: ProductWithCategory) => 
                          total + (parseFloat(product.price) * product.stock), 0
                        )
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {settings.map((setting) => (
                    <div key={setting.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{setting.key.replace(/_/g, ' ').toUpperCase()}</div>
                        <div className="text-sm text-muted-foreground">{setting.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{setting.value}</div>
                        <div className="text-xs text-muted-foreground">{setting.category}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline" className="h-20 flex flex-col gap-2">
                    <TrendingUp className="h-6 w-6" />
                    Generate Sales Report
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col gap-2">
                    <Package className="h-6 w-6" />
                    Export Inventory
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ProductModal
        open={showProductModal}
        onOpenChange={setShowProductModal}
        product={selectedProduct}
      />
    </div>
  );
}