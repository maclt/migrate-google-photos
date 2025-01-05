# Migrate Google Photos
This helps you to download the batch of photos from Google Photo.  
To save [the cost of Google One](https://one.google.com/about/plans?g1_landing_page=0), let's archive the data in Google Photo.  

## Prerequisites
- install NodeJS

## Steps
### Step 1 Enable Photos Library API

### Step 2 Set up OAuth consent screen
Add scopes `https://www.googleapis.com/auth/photoslibrary`  
Create Test users with your google account.  

### Step 3 Create credential
Create OAuth 2.0 Client IDs as credential for Photos Library API.  
The application type is `Desktop App`.  

### Step 4 Create credential.json
Download OAuth 2.0 Client ID JSON file. 
Put this JSON file in the root of this project.  
Change file name to `credential.json`.  
Update `redirect_uris`'s value to `http://localhost:3000`.  

### Step 5 Execute Script
Set start date and end date in `download.js`.
```
const startDate = { year: 2023, month: 1, day: 1 };
const endDate = { year: 2023, month: 12, day: 31 };
```

### Step 6 Execute Script
``` 
$ node download.js
```
## Limitation
You cannot delete the photos in Google Photos because Google does not provide DELETE API.

## Reference
https://developers.google.com/photos/library/reference/rest

