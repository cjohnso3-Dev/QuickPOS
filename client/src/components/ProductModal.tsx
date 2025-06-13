import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ProductWithCategory, Category } from "@shared/schema";
import { X, Upload, Plus, Trash2 } from "lucide-react";

interface ProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductWithCategory | null;
}

export default function ProductModal({ open, onOpenChange, product }: ProductModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: "",
    sku: "",
    stock: "",
    minStock: "5",
    maxStock: "100",
    imageUrl: "",
    allowModifications: true,
  });

  const [modificationOptions, setModificationOptions] = useState<any[]>([]);
  const [newModification, setNewModification] = useState({
    name: "",
    category: "",
    price: "0"
  });
  const { toast } = useToast();

  const {
    data: categories = [],
  } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        description: product.description || "",
        price: product.price,
        categoryId: product.categoryId?.toString() || "",
        sku: product.sku,
        stock: product.stock.toString(),
        minStock: (product.minStock || 5).toString(),
        maxStock: (product.maxStock || 100).toString(),
        imageUrl: product.imageUrl || "",
        allowModifications: product.allowModifications !== false,
      });
      setModificationOptions((product.modificationOptions as any[]) || []);
    } else {
      setFormData({
        name: "",
        description: "",
        price: "",
        categoryId: "",
        sku: "",
        stock: "",
        minStock: "5",
        maxStock: "100",
        imageUrl: "",
        allowModifications: true,
      });
      setModificationOptions([]);
    }
  }, [product, open]);

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create product");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Product created",
        description: "Product has been added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create product",
        variant: "destructive",
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/products/${product!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update product");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Product updated",
        description: "Product has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update product",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      name: formData.name,
      description: formData.description,
      price: formData.price,
      categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
      sku: formData.sku,
      stock: parseInt(formData.stock),
      minStock: parseInt(formData.minStock),
      maxStock: parseInt(formData.maxStock),
      imageUrl: formData.imageUrl,
      allowModifications: formData.allowModifications,
      modificationOptions: modificationOptions,
      isActive: true,
    };

    if (product) {
      updateProductMutation.mutate(submitData);
    } else {
      createProductMutation.mutate(submitData);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addModification = () => {
    if (!newModification.name.trim() || !newModification.category.trim()) {
      toast({
        title: "Invalid modification",
        description: "Please enter both name and category for the modification.",
        variant: "destructive",
      });
      return;
    }

    const modification = {
      id: `mod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newModification.name.trim(),
      category: newModification.category.trim(),
      price: parseFloat(newModification.price) || 0
    };

    setModificationOptions(prev => [...prev, modification]);
    setNewModification({ name: "", category: "", price: "0" });
  };

  const removeModification = (id: string) => {
    setModificationOptions(prev => prev.filter(mod => mod.id !== id));
  };

  const isLoading = createProductMutation.isPending || updateProductMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
           {product ? "Edit Product" : "Add New Product"}
         </DialogTitle>
         <DialogDescription>
           {product ? "Edit the details of the existing product." : "Add a new product to your inventory."}
         </DialogDescription>
       </DialogHeader>

       <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="name">Product Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => handleInputChange("sku", e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => handleInputChange("price", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => handleInputChange("categoryId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="stock">Initial Stock</Label>
              <Input
                id="stock"
                type="number"
                value={formData.stock}
                onChange={(e) => handleInputChange("stock", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="minStock">Minimum Stock</Label>
              <Input
                id="minStock"
                type="number"
                value={formData.minStock}
                onChange={(e) => handleInputChange("minStock", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="maxStock">Maximum Stock</Label>
              <Input
                id="maxStock"
                type="number"
                value={formData.maxStock}
                onChange={(e) => handleInputChange("maxStock", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="imageUrl">Product Image URL</Label>
            <Input
              id="imageUrl"
              type="url"
              value={formData.imageUrl}
              onChange={(e) => handleInputChange("imageUrl", e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
            <div className="mt-2 text-sm text-slate-500">
              Enter a URL for the product image, or leave empty for a placeholder
            </div>
          </div>

          {/* Modifications Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Product Modifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="allowModifications"
                  checked={formData.allowModifications}
                  onChange={(e) => handleInputChange("allowModifications", e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="allowModifications">Allow modifications for this product</Label>
              </div>

              {formData.allowModifications && (
                <>
                  <Separator />
                  
                  {/* Add New Modification */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Add Modification Option</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <Input
                        placeholder="Name (e.g., Small, Large)"
                        value={newModification.name}
                        onChange={(e) => setNewModification(prev => ({ ...prev, name: e.target.value }))}
                      />
                      <Input
                        placeholder="Category (e.g., size, milk)"
                        value={newModification.category}
                        onChange={(e) => setNewModification(prev => ({ ...prev, category: e.target.value }))}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Price modifier"
                        value={newModification.price}
                        onChange={(e) => setNewModification(prev => ({ ...prev, price: e.target.value }))}
                      />
                      <Button onClick={addModification} size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>

                  {/* Existing Modifications */}
                  {modificationOptions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Current Modifications</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {modificationOptions.map((mod) => (
                          <div key={mod.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Badge variant="outline">{mod.category}</Badge>
                              <span className="font-medium">{mod.name}</span>
                              <span className="text-sm text-gray-600">
                                {mod.price > 0 ? `+$${mod.price.toFixed(2)}` : mod.price < 0 ? `-$${Math.abs(mod.price).toFixed(2)}` : 'No charge'}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeModification(mod.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-gray-500 bg-blue-50 p-3 rounded">
                    <p><strong>Tips:</strong></p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Use "size" category for Small, Medium, Large options</li>
                      <li>Use "milk" category for milk alternatives</li>
                      <li>Use positive prices for upgrades, negative for discounts</li>
                      <li>Group related options under the same category</li>
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-4 pt-6 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                "Saving..."
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {product ? "Update Product" : "Add Product"}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
