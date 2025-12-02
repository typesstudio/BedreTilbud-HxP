import { db } from "../server/db";
import { companies } from "../shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

interface CSVCompany {
  name: string;
  description: string;
  email: string;
  logoUrl: string;
  insuranceTypes: string[];
  membershipRequired: string;
  region: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

function parseInsuranceTypes(typesStr: string): string[] {
  try {
    const cleaned = typesStr.replace(/\"\"/g, '"');
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function importCompanies() {
  const csvPath = path.join(process.cwd(), "attached_assets/Forsikrings_selskaber_1764678027505.csv");
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const lines = csvContent.split("\n").filter(line => line.trim());
  
  const header = lines[0];
  const dataLines = lines.slice(1);
  
  console.log(`Found ${dataLines.length} companies to import`);
  
  const companiesToInsert: CSVCompany[] = [];
  
  for (const line of dataLines) {
    const fields = parseCSVLine(line);
    
    if (fields.length < 7) {
      console.warn(`Skipping invalid line: ${line.substring(0, 50)}...`);
      continue;
    }
    
    const [name, description, email, logoUrl, insuranceTypesStr, membershipRequired, region] = fields;
    
    companiesToInsert.push({
      name: name.trim(),
      description: description.trim(),
      email: email.trim(),
      logoUrl: logoUrl.trim(),
      insuranceTypes: parseInsuranceTypes(insuranceTypesStr),
      membershipRequired: membershipRequired.trim(),
      region: region.trim(),
    });
  }
  
  console.log(`\nParsed ${companiesToInsert.length} companies:`);
  companiesToInsert.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name} (${c.email})`);
  });
  
  console.log("\nUpserting companies (insert or update by name)...");
  
  let inserted = 0;
  let updated = 0;
  
  for (const company of companiesToInsert) {
    const existing = await db.select().from(companies).where(
      eq(companies.name, company.name)
    );
    
    if (existing.length > 0) {
      await db.update(companies)
        .set({
          email: company.email,
          description: company.description,
          logoUrl: company.logoUrl || null,
          insuranceTypes: company.insuranceTypes,
          membershipRequired: company.membershipRequired || null,
          region: company.region || null,
          active: true,
        })
        .where(eq(companies.name, company.name));
      console.log(`  ↻ Updated: ${company.name}`);
      updated++;
    } else {
      await db.insert(companies).values({
        name: company.name,
        email: company.email,
        description: company.description,
        logoUrl: company.logoUrl || null,
        insuranceTypes: company.insuranceTypes,
        membershipRequired: company.membershipRequired || null,
        region: company.region || null,
        popular: false,
        active: true,
      });
      console.log(`  ✓ Inserted: ${company.name}`);
      inserted++;
    }
  }
  
  console.log(`\n✅ Import complete! Inserted: ${inserted}, Updated: ${updated}`);
  process.exit(0);
}

importCompanies().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
