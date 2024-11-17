TODO: Convert this to API spec

http://localhost:3000/listings

Status Codes
| Code | Description | |------|-------------| | 201 | Created (POST success) | | 200 | OK (GET, PATCH, DELETE success) | | 400 | Bad Request (validation errors) | | 404 | Not Found | | 500 | Internal Server Error |

Listing Status
| Status | Description | |--------|-------------| | A | Active | | E | Expired | | S | Sold | | D | Deleted |

POST /listings
{
"title": "iPhone 14 Pro Max",
"description": "Brand new iPhone 14 Pro Max, 256GB, Space Black",
"email": "seller@example.com",
"phone": "+1-234-567-8900",
"categoryId": 1,
"locationId": 1,
"images": [
{
"path": "/images/iphone-1.jpg",
"thumbnailPath": "/images/iphone-1-thumb.jpg",
"order": 0
},
{
"path": "/images/iphone-2.jpg",
"order": 1
}
]
}

GET /listings
GET /listings?categoryId=1&locationId=1&status=A[
{
"id": 1,
"title": "iPhone 14 Pro Max",
"slug": "iphone-14-pro-max-1",
"description": "Brand new iPhone 14 Pro Max, 256GB, Space Black",
"email": "seller@example.com",
"phone": "+1-234-567-8900",
"status": "A",
"categoryId": 1,
"locationId": 1,
"createdAt": "2024-01-17T12:00:00.000Z",
"updatedAt": "2024-01-17T12:00:00.000Z",
"category": {
"id": 1,
"name": "Electronics"
},
"location": {
"id": 1,
"name": "New York"
},
"images": [...]
}
]GET /listings/1{
"id": 1,
"title": "iPhone 14 Pro Max",
"slug": "iphone-14-pro-max-1",
// ... same as create response
}

PATCH /listings/1{
"title": "iPhone 14 Pro Max - PRICE REDUCED",
"description": "Like new iPhone 14 Pro Max, 256GB, Space Black. AppleCare+ included",
"status": "S",
"images": [
{
"path": "/images/iphone-new-1.jpg",
"thumbnailPath": "/images/iphone-new-1-thumb.jpg",
"order": 0
}
]
}
DELETE /listings/1{
"success": true
}

Error

{
"error": "Listing not found"
}
