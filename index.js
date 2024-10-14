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
app.use(express.json());


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
    const filePath = path.join(__dirname, 'files/uploads', pathName);
    const unZipPath = path.join(__dirname, 'files/unzipped', unZipName);

    if (!fs.existsSync(path.join(__dirname, 'files/uploads'))) {
        fs.mkdirSync(path.join(__dirname, 'files/uploads'));
    }

    if (!fs.existsSync(path.join(__dirname, 'files/unzipped'))) {
        fs.mkdirSync(path.join(__dirname, 'files/unzipped'));
    }

    file.mv(filePath, (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'File Upload Failed! Try Again' });
        }

        fs.createReadStream(filePath)
            .pipe(unzipper.Extract({ path: unZipPath }))
            .on('close', async () => {

                return res.status(200).json({ success: true, path: unZipPath, message: "Upload Successful" });

            })
            .on('error', () => {
                res
                    .status(500)
                    .json({ success: false, message: "Uploading Failed" });
            });
    });
});

app.post('/validate', async (req, res) => {

    const { dirName } = req.body
    console.log(req)
    console.log(dirName)
    if (!dirName) {
        return res.status(400).json({ success: false, message: 'failed to find Directory' })
    }

    try {

        const dockerfilePath = await findDockerfile(dirName);

        if (!dockerfilePath) {
            return res.status(400).json({ success: false, message: "No Docker file found" });
        }

        const isDockerValid = await validateDockerfile(dockerfilePath);

        if (!isDockerValid) {
            return res.status(400).json({ success: false, message: 'Dockerfile is not valid' });
        }


        return res.status(200).json({ success: true, message: "Validation Successful" });



    } catch (err) {

        res
            .status(500)
            .json({ success: false, message: "Validating Failed" });

    }

})

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
        const safePath = dockerfilePath.replace(/ /g, '\\ ');
        exec(`hadolint ${safePath}`, (error, stdout, stderr) => {
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
