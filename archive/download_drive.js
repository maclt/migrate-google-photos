import { google } from 'googleapis';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import open from 'open';

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
    scope: ['https://www.googleapis.com/auth/drive'],
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

// Function to download photos from Google Drive
async function downloadPhotosFromDrive() {
  const drive = google.drive({ version: 'v3', auth });

  try {
    // List files in the "Google Photos" folder
    const response = await drive.files.list({
      q: "'root' in parents and mimeType contains 'image/'",
      fields: 'files(id, name, mimeType)',
      pageSize: 50,
    });

    const files = response.data.files || [];
    if (files.length === 0) {
      console.log('No photos found in Google Drive.');
      return;
    }

    console.log(`Found ${files.length} photos. Downloading...`);

    // Ensure download directory exists
    const downloadDir = path.join(__dirname, 'downloads');
    fs.mkdirSync(downloadDir, { recursive: true });

    // Download each photo
    for (const file of files) {
      try {
        const filePath = path.join(downloadDir, file.name);
        const fileStream = fs.createWriteStream(filePath);

        await drive.files.get(
          { fileId: file.id, alt: 'media' },
          { responseType: 'stream' }
        ).then((res) => {
          res.data.pipe(fileStream);
          return new Promise((resolve, reject) => {
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
          });
        });

        console.log(`Downloaded: ${file.name}`);
      } catch (downloadError) {
        console.error(`Error downloading ${file.name}:`, downloadError.message);
      }
    }

    console.log('All photos downloaded successfully.');
  } catch (error) {
    console.error('Error listing or downloading photos:', error.response ? error.response.data : error.message);
  }
}

// Authenticate and execute the download function
(async () => {
  await authenticate();
  await downloadPhotosFromDrive();
})();
