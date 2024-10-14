import express from 'express';
import fileUpload from 'express-fileupload';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import unzipper from 'unzipper';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';


const app = express();
const port = 3000;
app.use(fileUpload());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));

app.post('/upload', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }


    const file = req.files[Object.keys(req.files)[0]];

    if (!file.name.endsWith('.zip')) {
        return res.status(400).json({ success: false, message: 'File needs to be a zip' });
    }

    const pathName = uuidv4() + '_' + file.name;
    const unZipName = 'Extracted_' + pathName;
    const filePath = path.join(__dirname, 'uploads', pathName);
    const unZipPath = path.join(__dirname, 'unzipped', unZipName);

    if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
        fs.mkdirSync(path.join(__dirname, 'uploads'));
    }

    if (!fs.existsSync(path.join(__dirname, 'unzipped'))) {
        fs.mkdirSync(path.join(__dirname, 'unzipped'));
    }

    file.mv(filePath, (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'File Upload Failed! Try Again' });
        }

        fs.createReadStream(filePath)
            .pipe(unzipper.Extract({ path: unZipPath }))
            .on('close', async () => {
                const dockerfilePath = await findDockerfile(unZipPath);

                if (!dockerfilePath) {
                    return res.status(500).send('No Dockerfile found!');
                }

                const isDockerValid = await validateDockerfile(dockerfilePath);

                if (!isDockerValid) {
                    return res.status(500).send('Docker file is not valid!');
                }


                return res.status(200).send('Docker File Is Valid')

            })
            .on('error', () => {
                return res.status(500).send('Unzipping failed!');
            });
    });
});

async function findDockerfile(dir) {
    const files = fs.readdirSync(dir);
    for (let file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            const foundDockerfile = await findDockerfile(fullPath);
            if (foundDockerfile) return foundDockerfile;
        } else if (file === 'Dockerfile') {
            return fullPath;
        }
    }
    return null;
}

function validateDockerfile(dockerfilePath) {
    return new Promise((resolve, reject) => {
        exec(`hadolint ${dockerfilePath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Dockerfile validation failed: ${stderr}`);
                return resolve(false);
            }
            console.log(`Dockerfile valid: ${stdout}`);
            resolve(true);
        });
    });
}


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});
