import { createInventoryStore, INVENTORY_PATH } from "../lib/inventory.js";
import { seedInventory } from "../lib/inventory-seed.js";

const store = createInventoryStore({ filePath: INVENTORY_PATH });
const report = seedInventory(store);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
