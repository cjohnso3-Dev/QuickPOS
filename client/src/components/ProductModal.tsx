import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ProductWithCategory, Category } from "@shared/schema";
import { X, Upload, Plus } from "lucide-react";

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
      });
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
      });
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
      isActive: true,
    };

    if (product) {
      updateProductMutation.mutate(submitData);
    } else {
      createProductMutation.mutate(submitData);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isLoading = createProductMutation.isPending || updateProductMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product ? "Edit Product" : "Add New Product"}
          </DialogTitle>
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
