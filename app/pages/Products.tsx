import { useLoaderData } from "react-router";
import type { Product } from "../../types/Product";

export default function Products() {
  const products = useLoaderData<Product[]>();

  return (
    <div style={{ padding: "20px" }}>
      <h1>Products</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        {products.map((product) => (
          <div key={product.id} style={{ border: "1px solid #ddd", padding: "10px" }}>
            {product.image && (
              <img
                src={product.image}
                alt={product.title}
                style={{ width: "100%", height: "150px", objectFit: "cover" }}
              />
            )}
            <h3>{product.title}</h3>
            <p>Status: {product.status}</p>
            <p>Inventory: {product.inventory}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
