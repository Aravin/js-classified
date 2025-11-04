# Auth Header Validation Guide

## How Auth Validation Works

### Client Side
1. User logs in → receives `id_token` from Auth0
2. When calling secured APIs (like `/contact`), `getAuthHeaders()` automatically:
   - Retrieves the ID token
   - Adds it to the request: `Authorization: Bearer <id_token>`

### Server Side
The server validates the auth header using the `verifyAuth0Token` middleware:

1. **Extracts token** from `Authorization: Bearer <token>` header
2. **Validates token format** (must be JWT with 3 parts)
3. **Detects token type**:
   - ID Token: audience = client ID
   - Access Token: audience = API identifier
4. **Verifies token**:
   - Checks signature using Auth0's JWKS
   - Validates audience matches expected value
   - Validates issuer matches Auth0 domain
   - Checks token hasn't expired
5. **Attaches user info** to `request.user` if valid
6. **Returns 401** if validation fails

## How to Protect Routes

### Example: Contact API (already protected)

```typescript
// In listing.routes.ts
import { verifyAuth0Token } from '../../middleware/auth';

// Protect the route
fastify.get('/:id/contact', {
  preHandler: verifyAuth0Token  // ← This validates the auth header
}, async (request, reply) => {
  // request.user is available here if token is valid
  // request.user.sub contains the user ID
  // ...
});
```

### Protecting Other Routes

To protect any route, add `preHandler: verifyAuth0Token`:

```typescript
// Example: Protect a DELETE route
fastify.delete('/:id', {
  preHandler: verifyAuth0Token
}, async (request, reply) => {
  // Only authenticated users can access this
  const userId = request.user?.sub;
  // ...
});

// Example: Protect a PATCH route
fastify.patch('/:id', {
  preHandler: verifyAuth0Token
}, async (request, reply) => {
  // Only authenticated users can access this
  // ...
});
```

### Optional Auth (don't require, but validate if present)

```typescript
import { optionalAuth } from '../../middleware/auth';

fastify.get('/some-route', {
  preHandler: optionalAuth
}, async (request, reply) => {
  // request.user may or may not be set
  if (request.user) {
    // User is authenticated
  } else {
    // User is not authenticated, but route still works
  }
});
```

### Check Resource Ownership

```typescript
import { verifyAuth0Token, requireOwnership } from '../../middleware/auth';

fastify.delete('/:id', {
  preHandler: verifyAuth0Token
}, async (request, reply) => {
  const listing = await prisma.listing.findUnique({ where: { id } });
  
  // Check if user owns this resource
  if (!await requireOwnership(request, reply, listing.userId)) {
    return; // Already sent 403 response
  }
  
  // User owns the resource, proceed with deletion
  // ...
});
```

## Testing Auth Validation

### Test Without Token
```bash
curl http://localhost:8080/api/listings/123/contact
# Response: 401 { "error": "Missing Authorization header" }
```

### Test With Invalid Token
```bash
curl -H "Authorization: Bearer invalid-token" http://localhost:8080/api/listings/123/contact
# Response: 401 { "error": "Invalid or expired token" }
```

### Test With Valid Token
```bash
# Get ID token from browser console after login:
# const token = await getAuthHeaders().then(h => h.Authorization?.replace('Bearer ', ''));

curl -H "Authorization: Bearer <your-id-token>" http://localhost:8080/api/listings/123/contact
# Response: 200 { "id": 123, "contactInfo": { ... } }
```

## Server Environment Variables Required

Make sure your server `.env` has:

```bash
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id      # Required for ID token validation
AUTH0_AUDIENCE=https://api.locful.com  # Required for access token validation (optional if only using ID tokens)
```

## Current Protected Routes

- ✅ `GET /api/listings/:id/contact` - Requires authentication

## Adding Auth to More Routes

To protect additional routes, simply add the `preHandler` option:

```typescript
fastify.post('/protected-route', {
  preHandler: verifyAuth0Token
}, async (request, reply) => {
  // Your protected route logic
});
```

