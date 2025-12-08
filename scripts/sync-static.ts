import fs from "fs";
import path from "path";

const SOURCE_DIR = path.resolve(process.cwd(), "dist/public");
const TARGET_DIR = path.resolve(process.cwd(), "server/public");

function copyRecursive(src: string, dest: string): void {
  const stats = fs.statSync(src);
  
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function cleanDirectory(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function main(): void {
  console.log("📦 Syncing static assets...");
  console.log(`   Source: ${SOURCE_DIR}`);
  console.log(`   Target: ${TARGET_DIR}`);
  
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`❌ Source directory not found: ${SOURCE_DIR}`);
    console.error("   Make sure vite build completed successfully.");
    process.exit(1);
  }
  
  const indexPath = path.join(SOURCE_DIR, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.error(`❌ index.html not found in ${SOURCE_DIR}`);
    process.exit(1);
  }
  
  const assetsDir = path.join(SOURCE_DIR, "assets");
  if (!fs.existsSync(assetsDir)) {
    console.error(`❌ assets directory not found in ${SOURCE_DIR}`);
    process.exit(1);
  }
  
  console.log("   Cleaning target directory...");
  cleanDirectory(TARGET_DIR);
  
  console.log("   Copying files...");
  copyRecursive(SOURCE_DIR, TARGET_DIR);
  
  const targetAssets = path.join(TARGET_DIR, "assets");
  const assetFiles = fs.readdirSync(targetAssets);
  const jsFiles = assetFiles.filter(f => f.endsWith(".js"));
  const cssFiles = assetFiles.filter(f => f.endsWith(".css"));
  
  console.log(`✅ Sync complete!`);
  console.log(`   - ${jsFiles.length} JavaScript files`);
  console.log(`   - ${cssFiles.length} CSS files`);
  console.log(`   - ${assetFiles.length} total asset files`);
  
  if (jsFiles.length === 0 || cssFiles.length === 0) {
    console.warn("⚠️  Warning: Missing JS or CSS files in assets!");
    process.exit(1);
  }
}

main();
