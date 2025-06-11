import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProductWithCategory } from "@shared/schema";

interface ProductCardProps {
  product: ProductWithCategory;
  onAddToCart: (product: ProductWithCategory) => void;
}

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const handleClick = () => {
    if (product.stock > 0) {
      onAddToCart(product);
    }
  };

  return (
    <Card 
      className={`product-card ${product.stock > 0 ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <img
          src={product.imageUrl || "https://via.placeholder.com/300x200"}
          alt={product.name}
          className="w-full h-32 object-cover rounded-md mb-3"
        />
        <h3 className="font-semibold text-slate-900 mb-1">{product.name}</h3>
        <p className="text-sm text-slate-600 mb-2 line-clamp-2">
          {product.description}
        </p>
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-slate-900">
            ${product.price}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {product.stock} left
            </span>
            {product.stock <= (product.minStock || 5) && product.stock > 0 && (
              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                Low Stock
              </Badge>
            )}
            {product.stock <= 0 && (
              <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                Out of Stock
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
