const fs = require('fs');
const path = require('path');

const REPO_OWNER = 'v4nshshr';
const REPO_NAME = 'StoreDataManagementSystem';

// Directories and files to exclude
const EXCLUDE_PATHS = [
  'node_modules',
  '.env',
  '.git',
  'package-lock.json',
  'scripts/githubUploader.js'
];

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    const relPath = path.relative(path.join(__dirname, '..'), fullPath).replace(/\\/g, '/');

    // Skip excluded directories and files
    if (EXCLUDE_PATHS.some((ex) => relPath === ex || relPath.startsWith(ex + '/'))) {
      return;
    }

    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push({ fullPath, relPath });
    }
  });

  return arrayOfFiles;
}

async function uploadFile(token, file) {
  const fileContent = fs.readFileSync(file.fullPath);
  const base64Content = fileContent.toString('base64');
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${file.relPath}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Node-GitHub-Uploader'
    },
    body: JSON.stringify({
      message: `feat: add ${file.relPath}`,
      content: base64Content
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to upload ${file.relPath}: ${data.message || JSON.stringify(data)}`);
  }
  console.log(`Uploaded: ${file.relPath}`);
}

async function runUpload(token) {
  if (!token) {
    console.error('Error: GitHub Personal Access Token is required.');
    process.exit(1);
  }

  const rootDir = path.join(__dirname, '..');
  const files = getAllFiles(rootDir);
  console.log(`Found ${files.length} files to upload to https://github.com/${REPO_OWNER}/${REPO_NAME}...`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`[${i + 1}/${files.length}] Uploading ${file.relPath}...`);
    try {
      await uploadFile(token, file);
    } catch (err) {
      console.error(`Error uploading ${file.relPath}:`, err.message);
    }
  }

  console.log('All files successfully uploaded to GitHub!');
}

if (require.main === module) {
  const token = process.argv[2] || process.env.GITHUB_TOKEN;
  runUpload(token);
}

module.exports = runUpload;
