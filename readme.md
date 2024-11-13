## Data

Thanks to <https://www.geoapify.com/downloads/> & <https://www.data.gov.in/catalog/all-india-pincode-directory> for the data


Populated 129181 (196653) cities/villages data from geoapify

### Query to identify duplicate within geoapify data

```
WITH DuplicateLocations AS (
  SELECT
    name,
    dist,
    COUNT(*) AS duplicate_count
  FROM
    location
  WHERE
    name = dist
  GROUP BY
    name,
    dist
  HAVING
    COUNT(*) > 1
),
RankedDuplicates AS (
  SELECT
    name,
    dist,
    duplicate_count,
    DENSE_RANK() OVER (ORDER BY duplicate_count DESC) AS duplicate_count_rank
  FROM
    DuplicateLocations
)
SELECT
  l.*,
  rd.duplicate_count,
  rd.duplicate_count_rank
FROM
  location l
JOIN
  RankedDuplicates rd
ON
  l.name = rd.name AND
  l.dist = rd.dist 
ORDER BY
  l.state, l.name, l.id
  
```

We have manually deleted following ids after seeding the data
71, 264, 13, 41, 6, 710, 736, 709, 468, 3, 70, 67, 266,1055, 62, 52, 55, 351, 46, 318, 621, 603, 594, 584, 88, 89 ,96, 343, 56,

4352, 725, 3807, 671, 56754, 915, 2753, 3470, 2776,121445, 3089, 2577, 641, 592, 595, 176040, 4111

