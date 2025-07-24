# Feeds Platform Migration: v4.x → v5.0

## Breaking Change: Collection Response Format

### Before (Array)

```javascript
// Response was an array
[
  { context: "feeds", type: "post", actor: {...}, object: {...} },
  // ... more items
]
```

### After (Collection)

```javascript
// Response is now a Collection object
{
  context: "feeds",
  type: "collection", 
  summary: "Feed Name",
  totalItems: 20,
  items: [
    { context: "feeds", type: "post", actor: {...}, object: {...} },
    // ... more items
  ]
}
```

## Migration Steps

1. **Update response handling:**

   ```javascript
   // Old
   for (const item of response) { ... }
   
   // New  
   for (const item of response.items) { ... }
   ```

2. **Access metadata:**

   ```javascript
   const count = response.totalItems;
   const feedName = response.summary;
   ```

3. **Update tests:**

   ```javascript
   // Old
   expect(response.length).toBe(10);
   
   // New
   expect(response.totalItems).toBe(10);
   expect(response.items.length).toBe(10);
   ```

## Benefits

- W3C ActivityStreams Collections compliance
- Feed metadata (`totalItems`, `summary`)
- Future extensibility for pagination
