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
import type { ProductWithCategory, OrderWithItems, Setting } from "@shared/schema";
import { 
  DollarSign, 
  ShoppingBag, 
  AlertTriangle, 
  Package, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Check, 
  Save, 
  Upload 
} from "lucide-react";

export default function AdminPage() {
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithCategory | null>(null);
  const { toast } = useToast();

  const {
    data: stats,
    isLoading: statsLoading,
  } = useQuery({
    queryKey: ["/api/stats"],
  });

  const {
    data: products = [],
    isLoading: productsLoading,
  } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products"],
  });

  const {
    data: orders = [],
    isLoading: ordersLoading,
  } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/orders"],
  });

  const {
    data: settings = [],
  } = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete product");
    },
    onSuccess: () => {
      toast({
        title: "Product deleted",
        description: "Product has been removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/orders/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update order status");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Order updated",
        description: "Order status has been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ id, stock }: { id: number; stock: number }) => {
      const response = await fetch(`/api/products/${id}/stock`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock }),
      });
      if (!response.ok) throw new Error("Failed to update stock");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Stock updated",
        description: "Product stock has been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update stock",
        variant: "destructive",
      });
    },
  });

  const openProductModal = (product?: ProductWithCategory) => {
    setEditingProduct(product || null);
    setProductModalOpen(true);
  };

  const closeProductModal = () => {
    setEditingProduct(null);
    setProductModalOpen(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "processing":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStockStatus = (product: ProductWithCategory) => {
    if (product.stock <= 0) return { label: "Out of Stock", color: "bg-red-100 text-red-800" };
    if (product.stock <= (product.minStock || 5)) return { label: "Low Stock", color: "bg-yellow-100 text-yellow-800" };
    return { label: "In Stock", color: "bg-green-100 text-green-800" };
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Today's Sales</p>
                <p className="text-2xl font-bold text-slate-900">
                  ${statsLoading ? "..." : stats?.todaySales?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="text-green-600 text-xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Orders Today</p>
                <p className="text-2xl font-bold text-slate-900">
                  {statsLoading ? "..." : stats?.todayOrders || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="text-blue-600 text-xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Low Stock Items</p>
                <p className="text-2xl font-bold text-slate-900">
                  {statsLoading ? "..." : stats?.lowStockCount || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="text-yellow-600 text-xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Active Products</p>
                <p className="text-2xl font-bold text-slate-900">
                  {statsLoading ? "..." : stats?.activeProductCount || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="text-blue-600 text-xl" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Tabs */}
      <Tabs defaultValue="products" className="space-y-6">
        <Card>
          <CardContent className="p-2">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="products">
                <Package className="w-4 h-4 mr-2" />
                Products
              </TabsTrigger>
              <TabsTrigger value="orders">
                <ShoppingBag className="w-4 h-4 mr-2" />
                Orders
              </TabsTrigger>
              <TabsTrigger value="inventory">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Inventory
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Edit className="w-4 h-4 mr-2" />
                Settings
              </TabsTrigger>
            </TabsList>
          </CardContent>
        </Card>

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
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="pb-3 text-sm font-medium text-slate-700">Product</th>
                      <th className="pb-3 text-sm font-medium text-slate-700">Category</th>
                      <th className="pb-3 text-sm font-medium text-slate-700">Price</th>
                      <th className="pb-3 text-sm font-medium text-slate-700">Stock</th>
                      <th className="pb-3 text-sm font-medium text-slate-700">Status</th>
                      <th className="pb-3 text-sm font-medium text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productsLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-slate-200 rounded-lg animate-pulse" />
                              <div>
                                <div className="h-4 bg-slate-200 rounded w-24 animate-pulse" />
                                <div className="h-3 bg-slate-200 rounded w-16 mt-1 animate-pulse" />
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="h-4 bg-slate-200 rounded w-16 animate-pulse" />
                          </td>
                          <td className="py-3">
                            <div className="h-4 bg-slate-200 rounded w-12 animate-pulse" />
                          </td>
                          <td className="py-3">
                            <div className="h-4 bg-slate-200 rounded w-8 animate-pulse" />
                          </td>
                          <td className="py-3">
                            <div className="h-6 bg-slate-200 rounded-full w-16 animate-pulse" />
                          </td>
                          <td className="py-3">
                            <div className="flex space-x-2">
                              <div className="h-6 w-6 bg-slate-200 rounded animate-pulse" />
                              <div className="h-6 w-6 bg-slate-200 rounded animate-pulse" />
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      products.map(product => {
                        const stockStatus = getStockStatus(product);
                        return (
                          <tr key={product.id} className="border-b border-slate-100">
                            <td className="py-3">
                              <div className="flex items-center space-x-3">
                                <img
                                  src={product.imageUrl || "https://via.placeholder.com/40"}
                                  alt={product.name}
                                  className="w-10 h-10 rounded-lg object-cover"
                                />
                                <div>
                                  <p className="font-medium text-slate-900">{product.name}</p>
                                  <p className="text-sm text-slate-600">SKU: {product.sku}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 text-sm text-slate-600">
                              {product.category?.name || "Uncategorized"}
                            </td>
                            <td className="py-3 text-sm font-medium text-slate-900">
                              ${product.price}
                            </td>
                            <td className="py-3">
                              <span className="text-sm font-medium text-slate-900">
                                {product.stock}
                              </span>
                            </td>
                            <td className="py-3">
                              <Badge className={stockStatus.color}>
                                {stockStatus.label}
                              </Badge>
                            </td>
                            <td className="py-3">
                              <div className="flex space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openProductModal(product)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteProductMutation.mutate(product.id)}
                                  disabled={deleteProductMutation.isPending}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orders Management */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Order Management</CardTitle>
                <Select defaultValue="all">
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter orders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Orders</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="pb-3 text-sm font-medium text-slate-700">Order ID</th>
                      <th className="pb-3 text-sm font-medium text-slate-700">Customer</th>
                      <th className="pb-3 text-sm font-medium text-slate-700">Items</th>
                      <th className="pb-3 text-sm font-medium text-slate-700">Total</th>
                      <th className="pb-3 text-sm font-medium text-slate-700">Status</th>
                      <th className="pb-3 text-sm font-medium text-slate-700">Time</th>
                      <th className="pb-3 text-sm font-medium text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-3">
                            <div className="h-4 bg-slate-200 rounded w-16 animate-pulse" />
                          </td>
                          <td className="py-3">
                            <div className="h-4 bg-slate-200 rounded w-24 animate-pulse" />
                          </td>
                          <td className="py-3">
                            <div className="h-4 bg-slate-200 rounded w-16 animate-pulse" />
                          </td>
                          <td className="py-3">
                            <div className="h-4 bg-slate-200 rounded w-12 animate-pulse" />
                          </td>
                          <td className="py-3">
                            <div className="h-6 bg-slate-200 rounded-full w-20 animate-pulse" />
                          </td>
                          <td className="py-3">
                            <div className="h-4 bg-slate-200 rounded w-16 animate-pulse" />
                          </td>
                          <td className="py-3">
                            <div className="flex space-x-2">
                              <div className="h-6 w-6 bg-slate-200 rounded animate-pulse" />
                              <div className="h-6 w-6 bg-slate-200 rounded animate-pulse" />
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      orders.map(order => (
                        <tr key={order.id} className="border-b border-slate-100">
                          <td className="py-3 text-sm font-medium text-primary">
                            #{order.id}
                          </td>
                          <td className="py-3 text-sm text-slate-900">
                            {order.customerName}
                          </td>
                          <td className="py-3 text-sm text-slate-600">
                            {order.items.length} items
                          </td>
                          <td className="py-3 text-sm font-medium text-slate-900">
                            ${order.total}
                          </td>
                          <td className="py-3">
                            <Badge className={getStatusColor(order.status)}>
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </Badge>
                          </td>
                          <td className="py-3 text-sm text-slate-600">
                            {new Date(order.createdAt!).toLocaleTimeString()}
                          </td>
                          <td className="py-3">
                            <div className="flex space-x-2">
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                              {order.status !== "completed" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    updateOrderStatusMutation.mutate({
                                      id: order.id,
                                      status: "completed",
                                    })
                                  }
                                  disabled={updateOrderStatusMutation.isPending}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Management */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Inventory Management</CardTitle>
                <Button>
                  <Upload className="w-4 h-4 mr-2" />
                  Bulk Update
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Inventory Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-600">Total Products</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {products.length}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-600">Low Stock Alerts</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {products.filter(p => p.stock <= (p.minStock || 5)).length}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-600">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-600">
                    {products.filter(p => p.stock <= 0).length}
                  </p>
                </div>
              </div>

              {/* Inventory Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="pb-3 text-sm font-medium text-slate-700">Product</th>
                      <th className="pb-3 text-sm font-medium text-slate-700">Current Stock</th>
                      <th className="pb-3 text-sm font-medium text-slate-700">Min. Stock</th>
                      <th className="pb-3 text-sm font-medium text-slate-700">Max. Stock</th>
                      <th className="pb-3 text-sm font-medium text-slate-700">Status</th>
                      <th className="pb-3 text-sm font-medium text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(product => {
                      const stockStatus = getStockStatus(product);
                      return (
                        <tr key={product.id} className="border-b border-slate-100">
                          <td className="py-3">
                            <div className="flex items-center space-x-3">
                              <img
                                src={product.imageUrl || "https://via.placeholder.com/32"}
                                alt={product.name}
                                className="w-8 h-8 rounded object-cover"
                              />
                              <span className="text-sm font-medium text-slate-900">
                                {product.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3">
                            <Input
                              type="number"
                              defaultValue={product.stock}
                              className="w-20"
                              onBlur={(e) => {
                                const newStock = parseInt(e.target.value);
                                if (newStock !== product.stock && !isNaN(newStock)) {
                                  updateStockMutation.mutate({
                                    id: product.id,
                                    stock: newStock,
                                  });
                                }
                              }}
                            />
                          </td>
                          <td className="py-3 text-sm text-slate-600">
                            {product.minStock || 5}
                          </td>
                          <td className="py-3 text-sm text-slate-600">
                            {product.maxStock || 100}
                          </td>
                          <td className="py-3">
                            <Badge className={stockStatus.color}>
                              {stockStatus.label}
                            </Badge>
                          </td>
                          <td className="py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={updateStockMutation.isPending}
                            >
                              <Save className="w-4 h-4" />
                            </Button>
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

        {/* Settings */}
        <TabsContent value="settings">
          <div className="space-y-6">
            {/* Store Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Store Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="store-name">Store Name</Label>
                    <Input
                      id="store-name"
                      defaultValue="Main Location"
                      placeholder="Enter store name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tax-rate">Tax Rate (%)</Label>
                    <Input
                      id="tax-rate"
                      type="number"
                      step="0.01"
                      defaultValue="8.25"
                      placeholder="8.25"
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Select defaultValue="USD">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="timezone">Time Zone</Label>
                    <Select defaultValue="America/New_York">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* API Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>API Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="stripe-publishable">Stripe Publishable Key</Label>
                    <Input
                      id="stripe-publishable"
                      type="text"
                      placeholder="pk_test_..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="stripe-secret">Stripe Secret Key</Label>
                    <Input
                      id="stripe-secret"
                      type="password"
                      placeholder="sk_test_..."
                    />
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex">
                      <AlertTriangle className="text-blue-500 mt-0.5 mr-3 w-5 h-5" />
                      <div>
                        <h4 className="text-sm font-medium text-blue-900">Stripe Integration</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          Enter your Stripe API keys to enable payment processing. These keys will be securely stored and encrypted.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save Settings */}
            <div className="flex justify-end space-x-4">
              <Button variant="outline">Reset</Button>
              <Button>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <ProductModal
        open={productModalOpen}
        onOpenChange={closeProductModal}
        product={editingProduct}
      />
    </div>
  );
}
