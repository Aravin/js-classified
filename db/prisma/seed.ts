import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { replaceAllCases } from './helpers/replace-string';
import { isEnglishAlphabet } from './helpers/is-english-alphabet';

const prisma = new PrismaClient();

async function main() {
  // Seed location data
  // await populateLocations();

  // clearn up locations
  // await manualDataCleanup();

  // Seed category data
  populateCategories();

  console.log('Seeding complete!');
}

async function populateLocations() {
  const files = ['place-city.ndjson', 'place-town.ndjson', 'place-hamlet.ndjson', 'place-village.ndjson'];
  for (const file of files) {
    // await populateLocations(file);

    const filePath = path.join(process.cwd(), '../', 'docs', fileName);

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity, // Handle different line endings
    });

    for await (const line of rl) {
      try {
        const jsonObject = JSON.parse(line);
        // Process each JSON object individually here
        console.log(jsonObject);

        // fix data
        // 1. remove ' district' from district name
        jsonObject.address.state_district = replaceAllCases(jsonObject.address.state_district, ' district', '');

        // 2. check if name is english
        if (!isEnglishAlphabet(jsonObject.name)) {
          jsonObject.name = jsonObject.other_names['name:en'];
        }

        // 3. ignore if empty name and type
        if (!jsonObject.name && !(jsonObject.address[jsonObject.type])) {
          continue;
        }

        // Insert data into the database
        const createdLocation = await prisma.location.create({
          data: {
            name: jsonObject.name ? jsonObject.name : jsonObject.address[jsonObject.type],
            loc_type: jsonObject.type,
            dist: jsonObject.address.state_district,
            state: jsonObject.address.state,
            state_code: jsonObject.address['ISO3166-2-lvl4'],
            country: jsonObject.address.country,
            country_code: jsonObject.address.country_code,
            pincode: jsonObject.address.postcode,
            coords: jsonObject.location?.join(','),
            bbox: jsonObject.bbox?.join(',')
          },
        });
        console.log(`Created location with id: ${createdLocation.id}`)
      } catch (error: unknown) {
        console.error(`Error parsing JSON on line: ${(error as Error).message}`);
        // Handle the error (e.g., skip the line, log it, or throw)
      }
    }
  }

}

async function manualDataCleanup() {
  const idsToDelete = '71, 264, 13, 41, 6, 710, 736, 709, 468, 3, 70, 67, 266,1055, 62, 52, 55, 351, 46, 318, 621, 603, 594, 584, 88, 89 ,96, 343,56, 4352, 725, 3807, 671, 56754, 915, 2753, 3470, 2776,121445, 3089, 2577, 641, 592, 595, 176040, 4111';

  await prisma.location.deleteMany({
    where: {
      id: {
        in: idsToDelete.split(',').map(Number),
      },
    },
  });

  console.log('Deleted locations with ids: ', idsToDelete);
}

async function populateCategories() {
  const filePath = path.join(process.cwd(), '../', 'docs', 'categories.json');
  
  // Read and parse the JSON file
  const categoriesData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Create parent categories first
  for (const [parentName, subCategories] of Object.entries(categoriesData)) {
    // Create slug from parent category name
    const parentSlug = parentName.toLowerCase().replace(/[&\s]+/g, '-');

    // Create parent category
    const parentCategory = await prisma.category.create({
      data: {
        name: parentName,
        slug: parentSlug,
      },
    });

    console.log(`Created parent category: ${parentCategory.name}`);

    // Create subcategories
    for (const subCategoryName of subCategories as string[]) {
      // Create slug from subcategory name
      const subCategorySlug = subCategoryName.toLowerCase().replace(/[&\s]+/g, '-');

      // Create subcategory with parent reference
      const subCategory = await prisma.category.create({
        data: {
          name: subCategoryName,
          slug: subCategorySlug,
          parent_category_id: parentCategory.id,
        },
      });

      console.log(`Created subcategory: ${subCategory.name} under ${parentCategory.name}`);
    }
  }

  console.log('Categories population complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });