"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Standalone migration runner.
 * Usage:  npx ts-node src/config/migrate.ts
 *
 * The same schema is also applied automatically on server startup
 * via runMigrations() in index.ts, so you only need this script
 * when you want to run migrations independently (CI, first deploy, etc.)
 */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("./database");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const migrate = async () => {
    console.log('▶  Running database migrations…');
    const sqlPath = path_1.default.join(__dirname, 'schema.sql');
    const sql = fs_1.default.readFileSync(sqlPath, 'utf8');
    try {
        await (0, database_1.query)(sql);
        console.log('✅  Database migrations completed successfully');
        process.exit(0);
    }
    catch (error) {
        console.error('❌  Migration failed:', error);
        process.exit(1);
    }
};
migrate();
//# sourceMappingURL=migrate.js.map