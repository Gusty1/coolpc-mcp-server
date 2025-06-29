#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ProductSpec {
  index: string;
  group: string | null;
  brand: string;
  model: string;
  specs: string[];
  price: number;
  original_price: number | null;
  discount_amount: number | null;
  markers: string[];
  raw_text: string;
}

interface Subcategory {
  name: string;
  products: ProductSpec[];
}

interface ProductCategory {
  category_id: string;
  category_name: string;
  summary: string;
  stats: {
    total_items: number;
    hot_items: number;
    with_images: number;
    with_discussions: number;
    price_changes: number;
    time_limited: number;
  };
  subcategories: Subcategory[];
}

class CoolPCMCPServer {
  private server: Server;
  private productData: ProductCategory[] = [];

  constructor() {
    this.server = new Server(
      {
        name: "coolpc-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.loadProductData();
    this.setupHandlers();
  }

  private loadProductData() {
    try {
      const productPath = join(__dirname, "../product.json");
      const rawData = readFileSync(productPath, "utf-8");
      this.productData = JSON.parse(rawData);
    } catch (error) {
      console.error("Failed to load product data:", error);
    }
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "search_products",
            description: "Search for computer components by keyword, brand, or specifications",
            inputSchema: {
              type: "object",
              properties: {
                keyword: {
                  type: "string",
                  description: "Keyword to search for (brand, model, specs, etc.)",
                },
                category: {
                  type: "string",
                  description: "Category to filter by (optional)",
                },
                min_price: {
                  type: "number",
                  description: "Minimum price filter (optional)",
                },
                max_price: {
                  type: "number",
                  description: "Maximum price filter (optional)",
                },
                limit: {
                  type: "number",
                  description: "Maximum number of results to return (default: 10)",
                },
              },
              required: ["keyword"],
            },
          },
          {
            name: "get_product_by_model",
            description: "Get detailed information about a specific product by model number",
            inputSchema: {
              type: "object",
              properties: {
                model: {
                  type: "string",
                  description: "Exact model number to search for",
                },
              },
              required: ["model"],
            },
          },
          {
            name: "list_categories",
            description: "List all available product categories",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "get_category_products", 
            description: "Get all products in a specific category or subcategory",
            inputSchema: {
              type: "object",
              properties: {
                category_id: {
                  type: "string",
                  description: "Category ID to get products from",
                },
                subcategory_name: {
                  type: "string",
                  description: "Subcategory name to filter by (optional)",
                },
                limit: {
                  type: "number",
                  description: "Maximum number of results to return (default: 20)",
                },
              },
              required: ["category_id"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "search_products":
          return this.searchProducts(args);
        case "get_product_by_model":
          return this.getProductByModel(args);
        case "list_categories":
          return this.listCategories();
        case "get_category_products":
          return this.getCategoryProducts(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private searchProducts(args: any) {
    const { keyword, category, min_price, max_price, limit = 10 } = args;
    const results: any[] = [];

    for (const cat of this.productData) {
      if (category && !cat.category_name.toLowerCase().includes(category.toLowerCase())) {
        continue;
      }

      for (const subcat of cat.subcategories) {
        for (const product of subcat.products) {
          const searchText = `${product.brand} ${product.model} ${product.specs.join(" ")} ${product.raw_text}`.toLowerCase();
          
          if (!searchText.includes(keyword.toLowerCase())) {
            continue;
          }

          if (min_price && product.price < min_price) {
            continue;
          }

          if (max_price && product.price > max_price) {
            continue;
          }

          results.push({
            ...product,
            category_name: cat.category_name,
            subcategory_name: subcat.name,
          });

          if (results.length >= limit) {
            break;
          }
        }

        if (results.length >= limit) {
          break;
        }
      }

      if (results.length >= limit) {
        break;
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            total_found: results.length,
            results: results.map(p => ({
              brand: p.brand,
              model: p.model,
              specs: p.specs,
              price: p.price,
              original_price: p.original_price,
              discount_amount: p.discount_amount,
              category: p.category_name,
              subcategory: p.subcategory_name,
              markers: p.markers,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private getProductByModel(args: any) {
    const { model } = args;

    for (const cat of this.productData) {
      for (const subcat of cat.subcategories) {
        for (const product of subcat.products) {
          if (product.model.toLowerCase() === model.toLowerCase()) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    found: true,
                    product: {
                      brand: product.brand,
                      model: product.model,
                      specs: product.specs,
                      price: product.price,
                      original_price: product.original_price,
                      discount_amount: product.discount_amount,
                      category: cat.category_name,
                      subcategory: subcat.name,
                      markers: product.markers,
                      raw_text: product.raw_text,
                    },
                  }, null, 2),
                },
              ],
            };
          }
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            found: false,
            message: `Product with model "${model}" not found`,
          }, null, 2),
        },
      ],
    };
  }

  private listCategories() {
    const categories = this.productData.map(cat => ({
      category_id: cat.category_id,
      category_name: cat.category_name,
      stats: cat.stats,
      subcategories: cat.subcategories.map(subcat => ({
        name: subcat.name,
        product_count: subcat.products.length
      }))
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            total_categories: categories.length,
            categories,
          }, null, 2),
        },
      ],
    };
  }

  private getCategoryProducts(args: any) {
    const { category_id, subcategory_name, limit = 20 } = args;

    const category = this.productData.find(cat => cat.category_id === category_id);
    if (!category) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              found: false,
              message: `Category with ID "${category_id}" not found`,
            }, null, 2),
          },
        ],
      };
    }

    let allProducts: any[] = [];
    let subcategoryInfo = null;

    if (subcategory_name) {
      // Find specific subcategory
      const subcategory = category.subcategories.find(
        sub => sub.name.toLowerCase() === subcategory_name.toLowerCase()
      );
      
      if (!subcategory) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                found: false,
                message: `Subcategory "${subcategory_name}" not found in category "${category.category_name}"`,
              }, null, 2),
            },
          ],
        };
      }

      subcategoryInfo = subcategory.name;
      allProducts = subcategory.products.map(p => ({
        ...p,
        subcategory: subcategory.name
      }));
    } else {
      // Get all products from all subcategories
      for (const subcat of category.subcategories) {
        allProducts.push(...subcat.products.map(p => ({
          ...p,
          subcategory: subcat.name
        })));
      }
    }

    const products = allProducts.slice(0, limit).map(p => ({
      brand: p.brand,
      model: p.model,
      specs: p.specs,
      price: p.price,
      original_price: p.original_price,
      discount_amount: p.discount_amount,
      subcategory: p.subcategory,
      markers: p.markers,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            category_name: category.category_name,
            subcategory_filter: subcategoryInfo,
            total_products: allProducts.length,
            showing: products.length,
            products,
          }, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("CoolPC MCP Server running on stdio");
  }
}

const server = new CoolPCMCPServer();
server.run().catch(console.error);