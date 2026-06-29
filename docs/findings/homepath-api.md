# Fannie Mae HomePath API

## Search API Endpoint

The Fannie Mae HomePath application (SPA) fetches real estate listings directly via a GET request to their `cfl/property-inventory/search` endpoint using map boundaries.

**URL:** `https://homepath.fanniemae.com/cfl/property-inventory/search?bounds=32.613216,-97.000482,33.023792,-96.46371`
**Method:** `GET`

### Required Headers

No authorization tokens are required, but the API expects specific custom headers:

- `x-fnma-channel: web`
- `x-fnma-entity-id: ` (Can be empty)
- `content-type: application/json`
- `accept: application/json, text/plain, */*`

### Sample Response JSON (One Listing)

```json
{
  "numMyCfl": 0,
  "numCfl": 0,
  "numProperties": 400,
  "totalProperties": 4347,
  "properties": [
    {
      "propertyUuid": "9a791151-7d90-410b-9b63-b2a85a835a87",
      "propertyType": "Single Family",
      "addressLine1": "3032 DAHLIA DRIVE",
      "city": "DALLAS",
      "county": "DALLAS COUNTY",
      "state": "TX",
      "zipCode": "75216",
      "bedrooms": 2.0,
      "bathrooms": 1.0,
      "sqft": 972,
      "yearBuilt": 1955,
      "price": 100000.0,
      "listingType": "LISTED",
      "propertyListingStatus": "RETAIL_LISTING",
      "listingStartDate": 1782446400000,
      "reoId": "D2500Q8",
      "geoPoint": {
        "latitude": 32.69767,
        "longitude": -96.76733
      },
      "externalSystemId": "fd411282-9242-4cd3-9f5c-8cacf13b3c50",
      "primHiResImageUrl": "https://homepath.fanniemae.com/images/2eaac3a2b59b4e9d8f7d9ff646654878/REO2HP_D2500Q8_REOImage_478567401.jpg",
      "totalRecords": 4347,
      "retailStatus": "Just Listed",
      "onlineOfferOnly": true,
      "firstLookProgramIndicator": 3,
      "cflEligibilityIndicator": false,
      "occupancyStatusCode": 1,
      "primaryStatusCode": 9,
      "equatorStatusLabel": "Available",
      "marketingDescLanguageChecked": 1,
      "marketingDescLanguageFlagged": 0,
      "onCart": false,
      "hecmInd": true,
      "userFavorite": false,
      "auction": false,
      "justAdded": false,
      "endingSoon": false,
      "incentive": false,
      "tenantOccupied": false
    }
  ]
}
```

### Next Steps for Claude

Claude can build `lib/scrapers/sources/homepath.ts` by bounding box chunking or state/city iterating. It's a clean JSON API.
