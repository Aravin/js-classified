import type { Category } from './categories';

export const flattenCategories = (categories: Category): string[] => {
    const result: string[] = [];
  
    function traverse(obj: Category, path: string = "") {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const currentPath = path ? `${path} > ${key}` : key;
          if (Array.isArray(obj[key])) {
            obj[key].forEach((item: string) => {
              result.push(`${currentPath} > ${item}`);
            });
          } else {
            traverse(obj[key], currentPath);
          }
        }
      }
    }
  
    traverse(categories);
    return result;
  }
  