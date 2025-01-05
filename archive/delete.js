import { google } from 'googleapis';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import open from 'open';

const startDate = { year: 2015, month: 1, day: 1 };
const endDate = { year: 2015, month: 12, day: 31 };

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// OAuth2 client setup
const credentials = JSON.parse(fs.readFileSync('credentials.json'));
const { client_id, client_secret, redirect_uris } = credentials.installed;
const auth = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3000');

const TOKEN_PATH = path.join(__dirname, 'tokens.json');

// Function to authenticate using localhost:3000 redirect
async function authenticate() {
  if (fs.existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
    auth.setCredentials(tokens);
    console.log('Loaded existing tokens.');
    return;
  }

  const authUrl = auth.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/photoslibrary'],
    prompt: 'consent',
  });

  console.log('Authorize this app by visiting this URL:', authUrl);
  open(authUrl);

  const app = express();
  app.get('/', async (req, res) => {
    const code = req.query.code;
    if (!code) {
      res.send('Authorization code not found.');
      return;
    }

    try {
      const { tokens } = await auth.getToken(code);
      auth.setCredentials(tokens);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log('Tokens received and saved.');
      res.send('Authorization successful! You can close this window.');
    } catch (error) {
      console.error('Error retrieving access token:', error);
      res.send('Error retrieving access token.');
    } finally {
      process.exit();
    }
  });

  app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
}

// Function to delete photos with pagination
async function deletePhotos() {
  try {
    const accessToken = await auth.getAccessToken();
    let pageToken = null;
    let totalDeleted = 0;

    do {
      const response = await axios.post(
        'https://photoslibrary.googleapis.com/v1/mediaItems:search',
        {
          filters: {
            dateFilter: {
              ranges: [{ startDate, endDate }],
            },
          },
          pageSize: 50,
          pageToken: pageToken,
        },
        {
          headers: { Authorization: `Bearer ${accessToken.token}` },
        }
      );

      const mediaItems = response.data.mediaItems || [];
      if (mediaItems.length === 0) {
        console.log('No more photos found in the specified date range.');
        break;
      }

      console.log(`Found ${mediaItems.length} photos on this page. Deleting...`);

      for (const item of mediaItems) {
        try {
          await axios.delete(`https://photoslibrary.googleapis.com/v1/mediaItems/${item.id}`, {
            headers: { Authorization: `Bearer ${accessToken.token}` },
          });
          console.log(`Deleted: ${item.filename} (ID: ${item.id})`);
          totalDeleted++;
        } catch (deleteError) {
          console.error(
            `Error deleting ${item.filename}:`,
            deleteError.response ? deleteError.response.data : deleteError.message
          );
        }
      }

      pageToken = response.data.nextPageToken || null; // Set the next page token, or null if no more pages
    } while (pageToken);

    console.log(`Total photos deleted: ${totalDeleted}`);
  } catch (error) {
    console.error('Error fetching or deleting photos:', error.response ? error.response.data : error.message);
  }
}

// Authenticate and execute functions
(async () => {
  await authenticate();
  await deletePhotos();
})();
