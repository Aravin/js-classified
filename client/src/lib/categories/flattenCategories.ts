import type { Category } from './categories';

export const flattenCategories = (categories: Category) => {
    const result: { key: number, value: string, display: string }[] = [];
  
    function traverse(obj: Category, path: string = "") {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const currentPath = path ? `${path} > ${key}` : key;
          if (Array.isArray(obj[key])) {
            obj[key].forEach((item: string) => {
              result.push({ key: Math.random(), value: item, display: `${currentPath} > ${item}`});
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
  