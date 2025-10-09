import { db } from "./db";
import { companies } from "@shared/schema";

async function seed() {
  console.log("Seeding database...");
  
  const defaultCompanies = [
    {
      name: "Alka Forsikring",
      email: "tilbud@alka.dk",
      description: "Specialister i bilforsikring",
      active: true
    },
    {
      name: "Tryg",
      email: "kundeservice@tryg.dk",
      description: "Danmarks største forsikringsselskab",
      active: true
    },
    {
      name: "Topdanmark",
      email: "info@topdanmark.dk",
      description: "Traditionel dansk forsikring",
      active: true
    },
    {
      name: "svphil",
      email: "svphil@gmail.com",
      description: "Moderne forsikringsløsninger",
      active: true
    },
    {
      name: "Types Studio",
      email: "hello@typesstudio.com",
      description: "Digital forsikring",
      active: true
    }
  ];

  for (const company of defaultCompanies) {
    await db.insert(companies).values(company).onConflictDoNothing();
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
