import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { replaceAllCases } from './helpers/replace-string';
import { isEnglishAlphabet } from './helpers/is-english-alphabet';

const prisma = new PrismaClient();

async function main() {
  // Seed location data
  const files = ['place-city.ndjson', 'place-town.ndjson', 'place-hamlet.ndjson', 'place-village.ndjson'];

  for (const file of files) {
    // await populateLocations(file);
  }

  await manualDataCleanup();


  console.log('Seeding complete!');
}

async function populateLocations(fileName: string) {
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
        jsonObject.name =jsonObject.other_names['name:en'];
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

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });