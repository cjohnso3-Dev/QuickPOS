import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogDescription } from "@/components/ui/dialog"; // Added for accessibility
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ProductModal from "@/components/ProductModal";
import PosAdminDashboard from "@/components/PosAdminDashboard";
import type { ProductWithCategory, OrderWithDetails, Setting, Category, InsertCategory } from "@shared/schema";
import {
  DollarSign,
  ShoppingBag,
  AlertTriangle, 
  Package, 
  Plus, 
  Edit, 
  Trash2, 
  TrendingUp,
 Settings as SettingsIcon,
 LayoutGrid // Added for Categories icon
} from "lucide-react";

export default function AdminPage() {
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const { toast } = useToast();

  // Category State
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [isEditingCategory, setIsEditingCategory] = useState(false);
 
  const { data: products = [], isLoading: productsLoading } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products"],
    queryFn: () => fetch("/api/products").then(res => res.json()),
  });
 
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: () => fetch("/api/categories").then(res => res.json()),
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

  // Category Mutations
  const createCategoryMutation = useMutation({
    mutationFn: async (newCategory: InsertCategory) => {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCategory),
      });
      if (!response.ok) throw new Error("Failed to create category");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Category created", description: "New category added successfully." });
      setCategoryName("");
      setCategoryDescription("");
      setIsEditingCategory(false);
      setSelectedCategory(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async (updatedCategory: Category) => {
      const response = await fetch(`/api/categories/${updatedCategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCategory),
      });
      if (!response.ok) throw new Error("Failed to update category");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Category updated", description: "Category updated successfully." });
      setCategoryName("");
      setCategoryDescription("");
      setIsEditingCategory(false);
      setSelectedCategory(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete category");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Category deleted", description: "Category deleted successfully." });
      setCategoryName("");
      setCategoryDescription("");
      setIsEditingCategory(false);
      setSelectedCategory(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCategorySubmit = () => {
    if (!categoryName) {
      toast({ title: "Error", description: "Category name is required.", variant: "destructive" });
      return;
    }
    if (isEditingCategory && selectedCategory) {
      updateCategoryMutation.mutate({ ...selectedCategory, name: categoryName, description: categoryDescription });
    } else {
      createCategoryMutation.mutate({ name: categoryName, description: categoryDescription });
    }
  };

  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category);
    setCategoryName(category.name);
    setCategoryDescription(category.description || "");
    setIsEditingCategory(true);
  };

  const handleCancelEditCategory = () => {
    setSelectedCategory(null);
    setCategoryName("");
    setCategoryDescription("");
    setIsEditingCategory(false);
  };
 
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" />
            Categories
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

        {/* Categories Management */}
        <TabsContent value="categories">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>{isEditingCategory ? "Edit Category" : "Add New Category"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="categoryName">Category Name</Label>
                    <Input
                      id="categoryName"
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      placeholder="e.g., Appetizers, Main Courses"
                    />
                  </div>
                  <div>
                    <Label htmlFor="categoryDescription">Description (Optional)</Label>
                    <Input
                      id="categoryDescription"
                      value={categoryDescription}
                      onChange={(e) => setCategoryDescription(e.target.value)}
                      placeholder="Brief description of the category"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={handleCategorySubmit} disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}>
                      {isEditingCategory ? "Update Category" : "Add Category"}
                    </Button>
                    {isEditingCategory && (
                      <Button variant="outline" onClick={handleCancelEditCategory}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Existing Categories</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Name</th>
                          <th className="text-left py-2">Description</th>
                          <th className="text-left py-2">Products</th>
                          <th className="text-left py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoriesLoading && <tr><td colSpan={4} className="text-center py-4">Loading categories...</td></tr>}
                        {!categoriesLoading && categories.map((category: Category) => (
                          <tr key={category.id} className="border-b">
                            <td className="py-2">{category.name}</td>
                            <td className="py-2">{category.description || "-"}</td>
                            <td className="py-2">
                              {products.filter(p => p.categoryId === category.id).length}
                            </td>
                            <td className="py-2">
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditCategory(category)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deleteCategoryMutation.mutate(category.id)}
                                  disabled={deleteCategoryMutation.isPending}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!categoriesLoading && categories.length === 0 && (
                          <tr>
                            <td colSpan={4} className="text-center py-4 text-muted-foreground">
                              No categories found. Add one to get started.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
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