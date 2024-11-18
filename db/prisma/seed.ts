import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { replaceAllCases } from './helpers/replace-string';
import { isEnglishAlphabet } from './helpers/is-english-alphabet';

const prisma = new PrismaClient();

async function main() {
  // Seed location data
  await populateLocations();

  // clearn up locations
  await manualDataCleanup();

  // Seed category data
  await populateCategories();

  // Create sample listings
  // await createSampleListings();

  console.log('Seeding complete!');
}

async function populateLocations() {
  const files = ['place-city.ndjson', 'place-town.ndjson', 'place-hamlet.ndjson', 'place-village.ndjson'];
  for (const file of files) {
    // await populateLocations(file);

    const filePath = path.join(process.cwd(), '../', 'docs', file);

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

async function createSampleListings() {
  // Get all locations and categories
  const locations = await prisma.location.findMany({
    where: {
      loc_type: 'city'
    }
  });
  console.log(`Found ${locations.length} cities`);
  console.log('Sample cities:', locations.slice(0, 5).map(l => l.name));

  // Get one subcategory from each parent category
  const parentCategories = await prisma.category.findMany({
    where: {
      parent_category_id: null // Get parent categories
    },
    include: {
      subcategories: {
        take: 1 // Take only one subcategory from each parent
      }
    }
  });

  // Flatten the subcategories array
  const categories = parentCategories.map(parent => parent.subcategories[0]).filter(Boolean);
  console.log(`Found ${categories.length} subcategories (one per parent category)`);
  console.log('Selected subcategories:', categories.map(c => c.name));

  // Sample titles and descriptions for each category
  const sampleContent = {
    'electronics': {
      titles: ['iPhone 13 Pro Max', 'Samsung 4K Smart TV', 'MacBook Pro M1', 'Sony PlayStation 5'],
      descriptions: ['Excellent condition, barely used', 'Brand new in box with warranty', 'Perfect working condition, all accessories included']
    },
    'vehicles': {
      titles: ['Honda Civic 2020', 'Toyota Camry', 'Royal Enfield Classic 350', 'Hyundai Creta'],
      descriptions: ['Single owner, well maintained', 'Low mileage, all service records available', 'Recently serviced, excellent condition']
    },
    'property': {
      titles: ['3BHK Luxury Apartment', '2BHK Independent House', 'Commercial Space for Rent', 'Plot for Sale'],
      descriptions: ['Prime location, ready to move', 'Newly constructed, modern amenities', 'Great investment opportunity']
    },
    'furniture': {
      titles: ['L-shaped Sofa Set', 'King Size Bed', 'Dining Table Set', 'Study Table'],
      descriptions: ['Premium quality material', 'Modern design, comfortable', 'Excellent condition, moving sale']
    }
  };

  // Create 2 listings for each category in each city
  for (const location of locations) {
    for (const category of categories) {
      const content = sampleContent[category.slug as keyof typeof sampleContent] || {
        titles: ['Sample Item', 'Quality Product'],
        descriptions: ['Great condition', 'Must see to appreciate']
      };

      for (let i = 0; i < 2; i++) {
        const title = content.titles[Math.floor(Math.random() * content.titles.length)];
        const description = content.descriptions[Math.floor(Math.random() * content.descriptions.length)];
        const price = Math.floor(Math.random() * 100000) + 1000; // Random price between 1000 and 101000

        try {
          const listing = await prisma.listing.create({
            data: {
              title: `${title} in ${location.name}`,
              description: `${description}. Located in ${location.name}.`,
              slug: `${title.toLowerCase().replace(/[&\s]+/g, '-')}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              price: price,
              email: `seller${Math.floor(Math.random() * 1000)}@example.com`,
              phone: `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`,
              categoryId: category.id,
              locationId: location.id,
              status: 'A',
              images: {
                create: [
                  {
                    path: 'https://via.placeholder.com/800x600',
                    thumbnailPath: 'https://via.placeholder.com/200x150',
                    order: 0
                  }
                ]
              }
            }
          });
          console.log(`Created listing: ${listing.title}`);
        } catch (error) {
          console.error(`Error creating listing: ${error}`);
        }
      }
    }
  }

  console.log('Sample listings creation complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });