import fs from "fs";
import path from "path";

const VITE_OUTPUT_DIR = path.resolve(process.cwd(), "dist/public");
const SERVER_PUBLIC_DIR = path.resolve(process.cwd(), "server/public");

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
  console.log(`   Source: ${VITE_OUTPUT_DIR}`);
  console.log(`   Target: ${SERVER_PUBLIC_DIR}`);
  
  if (!fs.existsSync(VITE_OUTPUT_DIR)) {
    console.error(`❌ Source directory not found: ${VITE_OUTPUT_DIR}`);
    console.error("   Make sure vite build completed successfully.");
    process.exit(1);
  }
  
  const indexPath = path.join(VITE_OUTPUT_DIR, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.error(`❌ index.html not found in ${VITE_OUTPUT_DIR}`);
    process.exit(1);
  }
  
  const assetsDir = path.join(VITE_OUTPUT_DIR, "assets");
  if (!fs.existsSync(assetsDir)) {
    console.error(`❌ assets directory not found in ${VITE_OUTPUT_DIR}`);
    process.exit(1);
  }
  
  console.log("   Cleaning target directory...");
  cleanDirectory(SERVER_PUBLIC_DIR);
  
  console.log("   Copying files...");
  copyRecursive(VITE_OUTPUT_DIR, SERVER_PUBLIC_DIR);
  
  const targetAssets = path.join(SERVER_PUBLIC_DIR, "assets");
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
