import type { Category } from './categories';

export interface FlattenedCategory {
  key: number;
  value: string;
  display: string;
}

export const flattenCategories = (categories: Category): FlattenedCategory[] => {
  const result: FlattenedCategory[] = [];

  function traverse(obj: Category) {
    for (const category in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, category)) {
        obj[category].forEach((item: string) => {
          result.push({ 
            key: Math.random(), 
            value: item, 
            display: `${category} > ${item}`
          });
        });
      }
    }
  }

  traverse(categories);
  return result;
}