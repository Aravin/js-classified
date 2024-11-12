export interface Category {
  [key: string]: Category | string[];
}

export const categories: Category = {
    "vehicles": {
      "cars": ["sedan", "suv", "truck", "van", "other"],
      "motorcycles": ["sport bike", "cruiser", "scooter", "other"],
      "rvs_campers": ["motorhome", "travel trailer", "other"],
      "boats": ["sailboat", "powerboat", "other"],
      "commercial_vehicles": ["truck", "van", "bus", "other"],
      "heavy_equipment": ["excavator", "bulldozer", "other"],
      "parts_accessories": ["tires", "wheels", "other"]
    },
    "real_estate": {
      "for_sale": {
        "residential": ["house", "apartment", "condo", "other"],
        "commercial": ["office space", "retail space", "other"]
      },
      "for_rent": {
        "residential": ["house", "apartment", "other"],
        "commercial": ["office space", "retail space", "other"]
      },
      "vacation_rentals": ["house", "cabin", "other"]
    },
    "jobs": {
      "by_type": ["full-time", "part-time", "contract", "other"],
      "by_industry": ["technology", "healthcare", "finance", "other"]
    },
    "for_sale": {
      "electronics": ["computers", "phones", "tvs", "other"],
      "appliances": ["refrigerators", "washers & dryers", "other"],
      "furniture": ["beds", "sofas", "other"],
      "clothing_accessories": ["men's clothing", "women's clothing", "other"],
      "baby_kids": ["toys", "clothes", "other"],
      "home_garden": ["tools", "plants", "other"],
      "sports_outdoors": ["bicycles", "camping gear", "other"],
      "books_media": ["books", "movies", "other"],
      "collectibles_art": ["antiques", "coins", "other"],
      "pets_animals": ["dogs", "cats", "other"],
      "musical_instruments": ["guitars", "pianos", "other"],
      "business_industrial": ["office equipment", "machinery", "other"],
      "tickets": ["concerts", "sports", "other"]
    },
    "services": {
      "home_services": ["cleaning", "repairs", "other"],
      "professional_services": ["legal", "financial", "other"],
      "event_services": ["catering", "photography", "other"],
      "health_beauty": ["hair salon", "massage", "other"],
      "lessons_tutoring": ["music lessons", "academic tutoring", "other"],
      "pet_services": ["dog walking", "pet sitting", "other"]
    },
    "community": {
      "events": ["concerts", "festivals", "other"],
      "classes_workshops": ["art classes", "cooking classes", "other"],
      "groups_clubs": ["book clubs", "sports clubs", "other"],      
      "lost_found": [],      
      "rideshare": [],      
      "volunteers": []      
    },
    "personals": {
      "dating": [],  
      "friendship": [] 
    }
  }