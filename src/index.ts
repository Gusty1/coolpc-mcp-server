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
            description: "General search across all computer components. Use this for broad searches or when component type is uncertain. For specific components, use dedicated search tools (search_cpu, search_gpu, etc.)",
            inputSchema: {
              type: "object",
              properties: {
                keyword: {
                  type: "string",
                  description: "Search keyword - can be brand name (Intel, AMD, NVIDIA), model number, or specifications. Examples: 'Intel', 'RTX', '32GB', 'B650'",
                },
                category: {
                  type: "string",
                  description: "Filter by product category. Examples: 'CPU', 'GPU', 'RAM', 'SSD', 'MB' (motherboard). Leave empty to search all categories",
                },
                min_price: {
                  type: "number",
                  description: "Minimum price in TWD. Example: 5000 for products above NT$5,000",
                },
                max_price: {
                  type: "number",
                  description: "Maximum price in TWD. Example: 20000 for products under NT$20,000",
                },
                limit: {
                  type: "number",
                  description: "Maximum number of results to return. Valid range: 1-100, default: 10",
                },
              },
              required: ["keyword"],
            },
          },
          {
            name: "search_cpu",
            description: "Specialized CPU/processor search tool. Find CPUs by socket compatibility, core count, and sort by price. Best for building compatible systems or finding CPUs with specific performance characteristics.",
            inputSchema: {
              type: "object",
              properties: {
                socket: {
                  type: "string",
                  description: "CPU socket type for motherboard compatibility. Intel examples: '1700' (12-14th gen), '1851' (Core Ultra). AMD examples: 'AM5' (Ryzen 7000/8000/9000), 'AM4' (older Ryzen)",
                },
                cores: {
                  type: "number",
                  description: "Number of physical CPU cores (not threads). Common values: 4, 6, 8, 10, 12, 16, 24, 32. Example: 6 for hex-core CPUs",
                },
                sort_by: {
                  type: "string",
                  enum: ["price_asc", "price_desc"],
                  description: "Price sorting order. 'price_asc' = cheapest first (budget builds), 'price_desc' = most expensive first (high-end builds)",
                },
                limit: {
                  type: "number",
                  description: "Maximum results to return. Valid range: 1-50, default: 10. Use higher values to see more options",
                },
              },
            },
          },
          {
            name: "search_gpu",
            description: "Specialized graphics card (VGA) search tool. Find GPUs by chipset model, VRAM capacity, and price. Perfect for gaming builds, content creation, or AI workloads.",
            inputSchema: {
              type: "object",
              properties: {
                chipset: {
                  type: "string",
                  description: "GPU chipset model. NVIDIA examples: 'RTX 4090', 'RTX 4070', 'RTX 4060', 'RTX 3060'. AMD examples: 'RX 7900', 'RX 7600'. Intel: 'Arc B580', 'Arc B570'",
                },
                memory: {
                  type: "number",
                  description: "Video memory (VRAM) capacity in GB. Common values: 8, 12, 16, 24. Example: 12 for 12GB VRAM cards suitable for 1440p gaming",
                },
                sort_by: {
                  type: "string",
                  enum: ["price_asc", "price_desc"],
                  description: "Price sorting order. 'price_asc' = cheapest first (value gaming), 'price_desc' = most expensive first (premium performance)",
                },
                limit: {
                  type: "number",
                  description: "Maximum results to return. Valid range: 1-50, default: 10. Higher values show more brand/model variations",
                },
              },
            },
          },
          {
            name: "search_ram",
            description: "Specialized memory (RAM) search tool. Find desktop or laptop memory by DDR generation, total capacity, speed, and price. Essential for system upgrades or new builds.",
            inputSchema: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  description: "RAM generation/type. Options: 'DDR4' (older systems, cheaper), 'DDR5' (newest, faster). Must match motherboard compatibility",
                },
                capacity: {
                  type: "number",
                  description: "Total memory capacity in GB. Common values: 8, 16, 32, 64. Example: 32 for 32GB total (can be 2x16GB or 4x8GB kit)",
                },
                frequency: {
                  type: "number",
                  description: "Memory speed in MHz. DDR4 common: 3200, 3600. DDR5 common: 4800, 5600, 6000. Higher = better performance",
                },
                sort_by: {
                  type: "string",
                  enum: ["price_asc", "price_desc"],
                  description: "Price sorting order. 'price_asc' = budget options first, 'price_desc' = premium/performance kits first",
                },
                limit: {
                  type: "number",
                  description: "Maximum results to return. Valid range: 1-50, default: 10. More results = more brand choices",
                },
              },
            },
          },
          {
            name: "search_ssd",
            description: "Specialized SSD/solid-state drive search tool. Find storage drives by interface type, capacity, and price. Covers M.2 NVMe, SATA, and PCIe drives for OS and data storage.",
            inputSchema: {
              type: "object",
              properties: {
                interface: {
                  type: "string",
                  description: "Storage interface/connection type. Options: 'M.2' (compact, fast), 'NVMe' (PCIe-based, fastest), 'SATA' (2.5\", compatible), 'PCIe' (add-in card). 'M.2 NVMe' for modern builds",
                },
                capacity: {
                  type: "number",
                  description: "Storage capacity in GB. Common values: 256, 512, 1000 (1TB), 2000 (2TB), 4000 (4TB). Example: 1000 for 1TB drives",
                },
                sort_by: {
                  type: "string",
                  enum: ["price_asc", "price_desc"],
                  description: "Price sorting order. 'price_asc' = value drives first, 'price_desc' = premium/high-performance drives first",
                },
                limit: {
                  type: "number",
                  description: "Maximum results to return. Valid range: 1-50, default: 10. More results show various brands/speeds",
                },
              },
            },
          },
          {
            name: "search_motherboard",
            description: "Specialized motherboard (MB/mainboard) search tool. Find motherboards by CPU socket, chipset, and size. Critical for system compatibility - must match CPU socket and case size.",
            inputSchema: {
              type: "object",
              properties: {
                socket: {
                  type: "string",
                  description: "CPU socket - MUST match your CPU. Intel: '1700' (12-14th gen), '1851' (Core Ultra). AMD: 'AM5' (Ryzen 7000+), 'AM4' (older Ryzen). Check CPU specs first!",
                },
                chipset: {
                  type: "string",
                  description: "Motherboard chipset determines features. Intel: 'Z790' (high-end), 'B760' (mainstream), 'H610' (budget). AMD: 'X670' (high-end), 'B650' (mainstream), 'A620' (budget)",
                },
                form_factor: {
                  type: "string",
                  description: "Physical size - must fit your case. 'ATX' (full size, most expansion), 'mATX' or 'MATX' (compact, good balance), 'ITX' (mini, small builds)",
                },
                sort_by: {
                  type: "string",
                  enum: ["price_asc", "price_desc"],
                  description: "Price sorting order. 'price_asc' = budget boards first, 'price_desc' = feature-rich boards first",
                },
                limit: {
                  type: "number",
                  description: "Maximum results to return. Valid range: 1-50, default: 10. More results = more brand/feature options",
                },
              },
            },
          },
          {
            name: "get_product_by_model",
            description: "Get detailed specifications and pricing for a specific product by exact model number. Use when you know the exact product model and need full details including specs, current price, and availability markers.",
            inputSchema: {
              type: "object",
              properties: {
                model: {
                  type: "string",
                  description: "Exact product model number (case-insensitive). Examples: 'i5-14400F', 'RTX 4060', 'B650M-PLUS', 'WD_BLACK SN770'. Must match exactly as listed",
                },
              },
              required: ["model"],
            },
          },
          {
            name: "list_categories",
            description: "Get a complete list of all product categories with statistics. Shows category names, product counts, and special markers (hot items, discounts). Useful for browsing available product types or understanding the catalog structure.",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "get_category_products", 
            description: "Browse all products within a specific category. Useful for exploring all options in a product type when you don't have specific search criteria. Returns products with full details including prices and specifications.",
            inputSchema: {
              type: "object",
              properties: {
                category_id: {
                  type: "string",
                  description: "Category ID from list_categories. Examples: 'cat_cpu' for processors, 'cat_vga' for graphics cards. Use list_categories first to get valid IDs",
                },
                subcategory_name: {
                  type: "string",
                  description: "Filter by specific subcategory name. Example: 'Intel Raptor Lake-s 14代1700 腳位' for 14th gen Intel CPUs. Optional - omit to see all subcategories",
                },
                limit: {
                  type: "number",
                  description: "Maximum products to return. Valid range: 1-100, default: 20. Higher values to see more products in the category",
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
        case "search_cpu":
          return this.searchCPU(args);
        case "search_gpu":
          return this.searchGPU(args);
        case "search_ram":
          return this.searchRAM(args);
        case "search_ssd":
          return this.searchSSD(args);
        case "search_motherboard":
          return this.searchMotherboard(args);
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

  private searchCPU(args: any) {
    const { socket, cores, sort_by, limit = 10 } = args;
    const results: any[] = [];

    // Find CPU category
    const cpuCategory = this.productData.find(cat => 
      cat.category_name.includes('CPU') || cat.category_name.includes('處理器')
    );

    if (!cpuCategory) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "CPU category not found",
              results: []
            }, null, 2),
          },
        ],
      };
    }

    // Search through all CPU subcategories
    for (const subcat of cpuCategory.subcategories) {
      for (const product of subcat.products) {
        let matches = true;

        // Filter by socket if specified
        if (socket) {
          const socketLower = socket.toLowerCase();
          const subcatLower = subcat.name.toLowerCase();
          const specsText = product.specs.join(' ').toLowerCase();
          const rawTextLower = product.raw_text.toLowerCase();
          
          if (!subcatLower.includes(socketLower) && 
              !specsText.includes(socketLower) && 
              !rawTextLower.includes(socketLower)) {
            matches = false;
          }
        }

        // Filter by cores if specified
        if (cores && matches) {
          const corePattern = new RegExp(`${cores}核`, 'i');
          const specsText = product.specs.join(' ');
          const hasCore = corePattern.test(specsText) || 
                         corePattern.test(product.raw_text) ||
                         corePattern.test(subcat.name);
          
          if (!hasCore) {
            matches = false;
          }
        }

        if (matches) {
          results.push({
            ...product,
            category_name: cpuCategory.category_name,
            subcategory_name: subcat.name,
          });
        }
      }
    }

    // Sort results
    if (sort_by === 'price_asc') {
      results.sort((a, b) => a.price - b.price);
    } else if (sort_by === 'price_desc') {
      results.sort((a, b) => b.price - a.price);
    }

    // Apply limit
    const limitedResults = results.slice(0, limit);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            total_found: results.length,
            showing: limitedResults.length,
            filters: {
              socket: socket || "any",
              cores: cores || "any",
              sort_by: sort_by || "none"
            },
            results: limitedResults.map(p => ({
              brand: p.brand,
              model: p.model,
              specs: p.specs,
              price: p.price,
              original_price: p.original_price,
              discount_amount: p.discount_amount,
              subcategory: p.subcategory_name,
              markers: p.markers,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private searchGPU(args: any) {
    const { chipset, memory, sort_by, limit = 10 } = args;
    const results: any[] = [];

    // Find GPU category
    const gpuCategory = this.productData.find(cat => 
      cat.category_name.includes('顯示卡') || cat.category_name.includes('VGA')
    );

    if (!gpuCategory) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "GPU category not found",
              results: []
            }, null, 2),
          },
        ],
      };
    }

    // Search through all GPU subcategories
    for (const subcat of gpuCategory.subcategories) {
      for (const product of subcat.products) {
        let matches = true;

        // Filter by chipset if specified
        if (chipset && matches) {
          const chipsetLower = chipset.toLowerCase();
          const subcatLower = subcat.name.toLowerCase();
          const specsText = product.specs.join(' ').toLowerCase();
          const modelLower = product.model?.toLowerCase() || '';
          const rawTextLower = product.raw_text.toLowerCase();
          
          if (!subcatLower.includes(chipsetLower) && 
              !specsText.includes(chipsetLower) && 
              !modelLower.includes(chipsetLower) &&
              !rawTextLower.includes(chipsetLower)) {
            matches = false;
          }
        }

        // Filter by memory if specified
        if (memory && matches) {
          const memPattern = new RegExp(`${memory}G(?:B)?`, 'i');
          const specsText = product.specs.join(' ');
          const hasMemory = memPattern.test(specsText) || 
                           memPattern.test(product.raw_text) ||
                           memPattern.test(product.model || '');
          
          if (!hasMemory) {
            matches = false;
          }
        }

        if (matches) {
          results.push({
            ...product,
            category_name: gpuCategory.category_name,
            subcategory_name: subcat.name,
          });
        }
      }
    }

    // Sort results
    if (sort_by === 'price_asc') {
      results.sort((a, b) => a.price - b.price);
    } else if (sort_by === 'price_desc') {
      results.sort((a, b) => b.price - a.price);
    }

    // Apply limit
    const limitedResults = results.slice(0, limit);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            total_found: results.length,
            showing: limitedResults.length,
            filters: {
              chipset: chipset || "any",
              memory: memory || "any",
              sort_by: sort_by || "none"
            },
            results: limitedResults.map(p => ({
              brand: p.brand,
              model: p.model,
              specs: p.specs,
              price: p.price,
              original_price: p.original_price,
              discount_amount: p.discount_amount,
              subcategory: p.subcategory_name,
              markers: p.markers,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private searchRAM(args: any) {
    const { type, capacity, frequency, sort_by, limit = 10 } = args;
    const results: any[] = [];

    // Find RAM category
    const ramCategory = this.productData.find(cat => 
      cat.category_name.includes('記憶體') || cat.category_name.includes('RAM')
    );

    if (!ramCategory) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "RAM category not found",
              results: []
            }, null, 2),
          },
        ],
      };
    }

    // Search through all RAM subcategories
    for (const subcat of ramCategory.subcategories) {
      for (const product of subcat.products) {
        let matches = true;

        // Filter by type if specified (DDR4, DDR5)
        if (type && matches) {
          const typeLower = type.toLowerCase();
          const subcatLower = subcat.name.toLowerCase();
          const specsText = product.specs.join(' ').toLowerCase();
          const rawTextLower = product.raw_text.toLowerCase();
          
          if (!subcatLower.includes(typeLower) && 
              !specsText.includes(typeLower) && 
              !rawTextLower.includes(typeLower)) {
            matches = false;
          }
        }

        // Filter by capacity if specified
        if (capacity && matches) {
          const capPattern = new RegExp(`${capacity}GB`, 'i');
          const specsText = product.specs.join(' ');
          const hasCapacity = capPattern.test(specsText) || 
                             capPattern.test(product.raw_text) ||
                             capPattern.test(product.model || '');
          
          if (!hasCapacity) {
            matches = false;
          }
        }

        // Filter by frequency if specified
        if (frequency && matches) {
          const freqPattern = new RegExp(`${frequency}(?:MHz)?`, 'i');
          const specsText = product.specs.join(' ');
          const hasFrequency = freqPattern.test(specsText) || 
                              freqPattern.test(product.raw_text);
          
          if (!hasFrequency) {
            matches = false;
          }
        }

        if (matches) {
          results.push({
            ...product,
            category_name: ramCategory.category_name,
            subcategory_name: subcat.name,
          });
        }
      }
    }

    // Sort results
    if (sort_by === 'price_asc') {
      results.sort((a, b) => a.price - b.price);
    } else if (sort_by === 'price_desc') {
      results.sort((a, b) => b.price - a.price);
    }

    // Apply limit
    const limitedResults = results.slice(0, limit);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            total_found: results.length,
            showing: limitedResults.length,
            filters: {
              type: type || "any",
              capacity: capacity || "any",
              frequency: frequency || "any",
              sort_by: sort_by || "none"
            },
            results: limitedResults.map(p => ({
              brand: p.brand,
              model: p.model,
              specs: p.specs,
              price: p.price,
              original_price: p.original_price,
              discount_amount: p.discount_amount,
              subcategory: p.subcategory_name,
              markers: p.markers,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private searchSSD(args: any) {
    const { interface: interfaceType, capacity, sort_by, limit = 10 } = args;
    const results: any[] = [];

    // Find SSD category
    const ssdCategory = this.productData.find(cat => 
      cat.category_name.includes('SSD') || cat.category_name.includes('固態硬碟')
    );

    if (!ssdCategory) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "SSD category not found",
              results: []
            }, null, 2),
          },
        ],
      };
    }

    // Search through all SSD subcategories
    for (const subcat of ssdCategory.subcategories) {
      for (const product of subcat.products) {
        let matches = true;

        // Filter by interface if specified
        if (interfaceType && matches) {
          const interfaceLower = interfaceType.toLowerCase();
          const subcatLower = subcat.name.toLowerCase();
          const specsText = product.specs.join(' ').toLowerCase();
          const rawTextLower = product.raw_text.toLowerCase();
          
          if (!subcatLower.includes(interfaceLower) && 
              !specsText.includes(interfaceLower) && 
              !rawTextLower.includes(interfaceLower)) {
            matches = false;
          }
        }

        // Filter by capacity if specified
        if (capacity && matches) {
          // Handle both GB and TB
          const capPatternGB = new RegExp(`${capacity}GB`, 'i');
          const capPatternTB = new RegExp(`${capacity / 1000}TB`, 'i');
          const specsText = product.specs.join(' ');
          const hasCapacity = capPatternGB.test(specsText) || 
                             capPatternGB.test(product.raw_text) ||
                             capPatternGB.test(product.model || '') ||
                             (capacity >= 1000 && (capPatternTB.test(specsText) || 
                                                   capPatternTB.test(product.raw_text) ||
                                                   capPatternTB.test(product.model || '')));
          
          if (!hasCapacity) {
            matches = false;
          }
        }

        if (matches) {
          results.push({
            ...product,
            category_name: ssdCategory.category_name,
            subcategory_name: subcat.name,
          });
        }
      }
    }

    // Sort results
    if (sort_by === 'price_asc') {
      results.sort((a, b) => a.price - b.price);
    } else if (sort_by === 'price_desc') {
      results.sort((a, b) => b.price - a.price);
    }

    // Apply limit
    const limitedResults = results.slice(0, limit);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            total_found: results.length,
            showing: limitedResults.length,
            filters: {
              interface: interfaceType || "any",
              capacity: capacity || "any",
              sort_by: sort_by || "none"
            },
            results: limitedResults.map(p => ({
              brand: p.brand,
              model: p.model,
              specs: p.specs,
              price: p.price,
              original_price: p.original_price,
              discount_amount: p.discount_amount,
              subcategory: p.subcategory_name,
              markers: p.markers,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private searchMotherboard(args: any) {
    const { socket, chipset, form_factor, sort_by, limit = 10 } = args;
    const results: any[] = [];

    // Find motherboard category
    const mbCategory = this.productData.find(cat => 
      cat.category_name.includes('主機板') || cat.category_name.includes('MB')
    );

    if (!mbCategory) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Motherboard category not found",
              results: []
            }, null, 2),
          },
        ],
      };
    }

    // Search through all motherboard subcategories
    for (const subcat of mbCategory.subcategories) {
      for (const product of subcat.products) {
        let matches = true;

        // Filter by socket if specified
        if (socket && matches) {
          const socketLower = socket.toLowerCase();
          const subcatLower = subcat.name.toLowerCase();
          const specsText = product.specs.join(' ').toLowerCase();
          const rawTextLower = product.raw_text.toLowerCase();
          
          if (!subcatLower.includes(socketLower) && 
              !specsText.includes(socketLower) && 
              !rawTextLower.includes(socketLower)) {
            matches = false;
          }
        }

        // Filter by chipset if specified
        if (chipset && matches) {
          const chipsetLower = chipset.toLowerCase();
          const specsText = product.specs.join(' ').toLowerCase();
          const modelLower = product.model?.toLowerCase() || '';
          const rawTextLower = product.raw_text.toLowerCase();
          
          if (!specsText.includes(chipsetLower) && 
              !modelLower.includes(chipsetLower) &&
              !rawTextLower.includes(chipsetLower)) {
            matches = false;
          }
        }

        // Filter by form factor if specified
        if (form_factor && matches) {
          const formLower = form_factor.toLowerCase();
          const specsText = product.specs.join(' ').toLowerCase();
          const rawTextLower = product.raw_text.toLowerCase();
          
          // Handle different form factor names
          const formFactorAliases: { [key: string]: string[] } = {
            'atx': ['atx', 'a.t.x'],
            'matx': ['matx', 'm-atx', 'micro atx', 'micro-atx'],
            'itx': ['itx', 'mini-itx', 'mini itx']
          };
          
          let hasFormFactor = false;
          const aliases = formFactorAliases[formLower] || [formLower];
          for (const alias of aliases) {
            if (specsText.includes(alias) || rawTextLower.includes(alias)) {
              hasFormFactor = true;
              break;
            }
          }
          
          if (!hasFormFactor) {
            matches = false;
          }
        }

        if (matches) {
          results.push({
            ...product,
            category_name: mbCategory.category_name,
            subcategory_name: subcat.name,
          });
        }
      }
    }

    // Sort results
    if (sort_by === 'price_asc') {
      results.sort((a, b) => a.price - b.price);
    } else if (sort_by === 'price_desc') {
      results.sort((a, b) => b.price - a.price);
    }

    // Apply limit
    const limitedResults = results.slice(0, limit);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            total_found: results.length,
            showing: limitedResults.length,
            filters: {
              socket: socket || "any",
              chipset: chipset || "any",
              form_factor: form_factor || "any",
              sort_by: sort_by || "none"
            },
            results: limitedResults.map(p => ({
              brand: p.brand,
              model: p.model,
              specs: p.specs,
              price: p.price,
              original_price: p.original_price,
              discount_amount: p.discount_amount,
              subcategory: p.subcategory_name,
              markers: p.markers,
            })),
          }, null, 2),
        },
      ],
    };
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